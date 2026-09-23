import { supabase } from '../supabase'
import { SESSION_TOKEN_KEY } from '../constants'

/**
 * `reason` and `manager_note` on a time-off request (migration 119).
 *
 * 091 scoped time_off_requests to the venue, but venue-scoping is not
 * role-scoping — has_venue_access() returns the same for a manager and a
 * kitchen porter. So every employee could read why a colleague booked time
 * off, which for time off is routinely medical or bereavement.
 *
 * Both columns are now withheld by column grant and served by
 * time_off_private_fields, which gives a manager the whole venue and everyone
 * else only their own requests. manager_note is included for the requester on
 * purpose: it is feedback on their own request and they should read it.
 *
 * Same contract as lib/api/staffPay: merge back by id, leave the fields absent
 * where the caller may not see them.
 */

export interface TimeOffPrivateFields {
  reason?:       string | null
  manager_note?: string | null
}

export async function fetchTimeOffPrivateFields(): Promise<Map<string, TimeOffPrivateFields>> {
  const token = (() => {
    try { return localStorage.getItem(SESSION_TOKEN_KEY) } catch { return null }
  })()
  if (!token) return new Map()

  const { data, error } = await supabase.rpc('time_off_private_fields', { p_session_token: token })

  if (error) {
    console.error(
      error.code === 'PGRST202'
        ? '[timeOffPrivate] time_off_private_fields is missing — migration 119 has not been applied. Time-off reasons will be blank.'
        : `[timeOffPrivate] could not load time-off reasons (${error.code}): ${error.message}. They will be blank.`
    )
    return new Map()
  }
  if (!Array.isArray(data)) return new Map()

  return new Map(
    data.map((r: { request_id: string } & TimeOffPrivateFields) => [
      r.request_id,
      { reason: r.reason, manager_note: r.manager_note },
    ])
  )
}

/** Merge the private fields back onto request rows keyed by `id`. */
export function withTimeOffPrivate<T extends { id?: string }>(
  rows: T[],
  fields: Map<string, TimeOffPrivateFields>,
): T[] {
  return rows.map(r => (r.id && fields.has(r.id) ? { ...r, ...fields.get(r.id) } : r))
}
