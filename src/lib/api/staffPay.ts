import { supabase } from '../supabase'
import { SESSION_TOKEN_KEY } from '../constants'

/**
 * Pay rates, fetched separately from the staff row.
 *
 * `hourly_rate` is no longer readable from the `staff` table (migration 117):
 * managers and plain staff share one Postgres role, so column grants cannot
 * tell them apart and pay had to move behind a SECURITY DEFINER function that
 * inspects the session instead.
 *
 * `staff_pay_rates` returns everyone in the venue for a manager or owner, and
 * only the caller's own row for anyone else. That means the merge helpers
 * below are safe to use on any code path: a staff member simply ends up with
 * rates for themselves and `undefined` for everybody else, which is exactly
 * what the cost views should show them.
 *
 * Reading the session token from localStorage here matches lib/sendPush.js
 * rather than threading a token through every caller — the rota, HR and
 * settings paths all reach this from different depths.
 */

export type PayRates = Map<string, number>

export async function fetchStaffPayRates(): Promise<PayRates> {
  const token = (() => {
    try { return localStorage.getItem(SESSION_TOKEN_KEY) } catch { return null }
  })()
  if (!token) return new Map()

  const { data, error } = await supabase.rpc('staff_pay_rates', { p_session_token: token })

  // An empty map means every cost downstream renders as £0, which looks like a
  // real answer. Say so loudly rather than letting a quiet zero stand in for
  // "could not load" — that is the failure mode 115 and 116 were about.
  if (error) {
    console.error(
      error.code === 'PGRST202'
        ? '[staffPay] staff_pay_rates is missing — migration 117 has not been applied. Labour costs will show as £0.'
        : `[staffPay] could not load pay rates (${error.code}): ${error.message}. Labour costs will show as £0.`
    )
    return new Map()
  }
  if (!Array.isArray(data)) return new Map()

  return new Map(
    data.map((r: { staff_id: string; hourly_rate: number | null }) => [r.staff_id, r.hourly_rate ?? 0])
  )
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
