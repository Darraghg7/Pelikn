import { supabase } from '../supabase'
import { SESSION_TOKEN_KEY } from '../constants'

/**
 * Staff fields the `staff` table no longer exposes.
 *
 * RLS is row-level, so venue-scoping `staff` (113/114) still left every column
 * of a visible row readable by any employee. Migrations 116–118 moved the
 * sensitive ones behind column grants:
 *
 *   116  pin_hash                         — withheld outright, nothing reads it
 *   117  hourly_rate                      — staff_pay_rates
 *   118  email, emergency contacts,       — staff_private_fields
 *        start_date, contracted_hours
 *
 * Column grants cannot express "managers only", because managers and plain
 * staff authenticate as the SAME Postgres role via the venue JWT pin-login
 * issues. So each of these lives behind a SECURITY DEFINER function that
 * inspects the session instead.
 *
 * Both functions follow the same rule: a manager or owner gets everyone in
 * their venue (plus staff linked to it), anyone else gets only their own row.
 * That makes the merge helpers safe on any code path — a staff member simply
 * ends up with their own values and `undefined` for everybody else, which is
 * exactly what these screens should show them.
 *
 * Reading the session token from localStorage here matches lib/sendPush.js
 * rather than threading a token through every caller — the rota, HR, timesheet
 * and settings paths all reach this from different depths.
 */

export type PayRates = Map<string, number>

/** Columns 118 moved out of the table. `undefined` where the caller may not see them. */
export interface StaffPrivateFields {
  email?:                   string | null
  emergency_contact_name?:  string | null
  emergency_contact_phone?: string | null
  start_date?:              string | null
  contracted_hours?:        number | null
}

function sessionToken(): string | null {
  try { return localStorage.getItem(SESSION_TOKEN_KEY) } catch { return null }
}

export async function fetchStaffPayRates(): Promise<PayRates> {
  const token = sessionToken()
  if (!token) return new Map()

  const { data, error } = await supabase.rpc('staff_pay_rates', { p_session_token: token })

  // An empty map means every cost downstream renders as £0, which looks like a
  // real answer. Say so loudly rather than letting a quiet zero stand in for
  // "could not load" — that is the failure mode 115 and 116 were about.
  if (error) {
    console.error(
      error.code === 'PGRST202'
        ? '[staffRestricted] staff_pay_rates is missing — migration 117 has not been applied. Labour costs will show as £0.'
        : `[staffRestricted] could not load pay rates (${error.code}): ${error.message}. Labour costs will show as £0.`
    )
    return new Map()
  }
  if (!Array.isArray(data)) return new Map()

  return new Map(
    data.map((r: { staff_id: string; hourly_rate: number | null }) => [r.staff_id, r.hourly_rate ?? 0])
  )
}

/**
 * Email, emergency contacts, start date and contracted hours (migration 118).
 *
 * Unlike pay there is no numeric default to get wrong here, so a failure
 * degrades to blank fields rather than a plausible-looking value. It is still
 * logged: a manager seeing an empty emergency contact should be able to tell
 * "not recorded" from "could not load".
 */
export async function fetchStaffPrivateFields(): Promise<Map<string, StaffPrivateFields>> {
  const token = sessionToken()
  if (!token) return new Map()

  const { data, error } = await supabase.rpc('staff_private_fields', { p_session_token: token })

  if (error) {
    console.error(
      error.code === 'PGRST202'
        ? '[staffRestricted] staff_private_fields is missing — migration 118 has not been applied. Contact and contract fields will be blank.'
        : `[staffRestricted] could not load private staff fields (${error.code}): ${error.message}. Those fields will be blank.`
    )
    return new Map()
  }
  if (!Array.isArray(data)) return new Map()

  return new Map(
    data.map((r: { staff_id: string } & StaffPrivateFields) => {
      const { staff_id, ...fields } = r
      return [staff_id, fields]
    })
  )
}

/** Merge private fields back onto staff rows, same contract as withPayRates. */
export function withPrivateFields<T extends { id?: string }>(
  rows: T[],
  fields: Map<string, StaffPrivateFields>,
): T[] {
  return rows.map(r => (r.id && fields.has(r.id) ? { ...r, ...fields.get(r.id) } : r))
}

/**
 * Put `hourly_rate` back onto staff objects so the cost calculations that read
 * `s.hourly_rate` keep working untouched. Anyone the caller may not see a rate
 * for is left without the field rather than defaulted to 0 — a missing rate and
 * a genuine £0 rate are different things, and silently rendering "£0" would be
 * the same class of quiet-wrong-answer this migration exists to remove.
 */
export function withPayRates<T extends { id?: string }>(rows: T[], rates: PayRates): T[] {
  return rows.map(r => (r.id && rates.has(r.id) ? { ...r, hourly_rate: rates.get(r.id) } : r))
}

/** Same, for rows that embed a staff object (e.g. shifts). */
export function withEmbeddedPayRates<T extends { staff?: { id?: string } | null }>(
  rows: T[],
  rates: PayRates,
): T[] {
  return rows.map(r =>
    r.staff?.id && rates.has(r.staff.id)
      ? { ...r, staff: { ...r.staff, hourly_rate: rates.get(r.staff.id) } }
      : r
  )
}
