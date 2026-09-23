import { supabase } from '../supabase'
import { format, addWeeks } from 'date-fns'
import { fetchStaffPayRates, withPayRates, withEmbeddedPayRates } from './staffRestricted'
import type { Shift, Staff } from '../../types'

// hourly_rate and email are deliberately absent. 117/118 revoked both from the
// column grant, and nothing on the rota ever read the email —
// and selecting it now fails the whole query rather than just omitting it.
// It is merged back in below from staff_pay_rates, so everything downstream
// that reads `s.hourly_rate` / `shift.staff.hourly_rate` is unchanged.
const SHIFT_SELECT = '*, staff(id, name, job_role, is_under_18)'
const STAFF_SELECT = 'id, name, role, job_role, skills, is_under_18, colour'

export async function fetchShifts(venueId: string, weekStart: Date, numWeeks = 1): Promise<Shift[]> {
  const weekStarts = Array.from({ length: Math.max(numWeeks, 1) }, (_, i) =>
    format(addWeeks(weekStart, i), 'yyyy-MM-dd')
  )

  // Rates come from the RPC in parallel with the shifts themselves, so this
  // stays one round trip's worth of latency rather than two.
  const [{ data }, rates] = await Promise.all([
    supabase
      .from('shifts')
      .select(SHIFT_SELECT)
      .eq('venue_id', venueId)
      .in('week_start', weekStarts)
      .order('shift_date')
      .order('start_time'),
    fetchStaffPayRates(),
  ])

  return withEmbeddedPayRates((data ?? []) as Shift[], rates)
}

export async function fetchStaffList(venueId: string): Promise<Staff[]> {
  const [{ data: homeStaff }, { data: links }, rates] = await Promise.all([
    supabase
      .from('staff')
      .select(STAFF_SELECT)
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('staff_venue_links')
      .select('staff_id, role, staff(id, name, job_role, skills, is_under_18, colour)')
      .eq('venue_id', venueId),
    fetchStaffPayRates(),
  ])

  // Drop links whose embedded staff didn't come back. RLS filters an embedded
  // join independently of the outer row, so a link can resolve to null — which
  // is what happened when 113 scoped the staff table: `{ ...null }` spreads to
  // `{}`, the list gained a nameless entry, and RotaWeekView's
  // `s.name.split(' ')` took the whole rota page down with it. 114 restores the
  // join, but a missing row must degrade to "that person isn't listed" rather
  // than crash the page.
  const linkedStaff = (links ?? [])
    .filter((l: any) => l.staff?.id)
    .map((l: any) => ({ ...l.staff, role: l.role, _crossVenue: true }))
  return withPayRates([...(homeStaff ?? []), ...linkedStaff] as Staff[], rates)
}

// ── Shift writes ─────────────────────────────────────────────────────────────

export function insertShift(payload: Record<string, unknown>) {
  return supabase.from('shifts').insert(payload).select('id').single()
}
export function insertShifts(payloads: Record<string, unknown>[]) {
  return supabase.from('shifts').insert(payloads)
}
export function updateShift(id: string, payload: Record<string, unknown>) {
  return supabase.from('shifts').update(payload).eq('id', id)
}
export function updateShiftStaff(id: string, staffId: string | null) {
  return supabase.from('shifts').update({ staff_id: staffId }).eq('id', id)
}
export function deleteShift(id: string) {
  return supabase.from('shifts').delete().eq('id', id)
}
export function deleteShiftsForWeek(venueId: string, weekStartStr: string) {
  return supabase.from('shifts').delete().eq('venue_id', venueId).eq('week_start', weekStartStr)
}

// ── Duty assignments ─────────────────────────────────────────────────────────

export function deleteDutyAssignmentsForShift(shiftId: string) {
  return supabase.from('duty_assignments').delete().eq('shift_id', shiftId)
}
export function insertDutyAssignment(payload: Record<string, unknown>) {
  return supabase.from('duty_assignments').insert(payload)
}

// ── Rota publish state + payroll locks (both stored in app_settings) ─────────

export async function fetchPayrollLocks(venueId: string): Promise<string[]> {
  const { data } = await supabase.from('app_settings').select('value').eq('venue_id', venueId).eq('key', 'payroll_locks').maybeSingle()
  try { return JSON.parse(data?.value ?? '[]') } catch { return [] }
}
export function upsertRotaPublished(venueId: string, weekStartStr: string, value: string) {
  return supabase.from('app_settings').upsert({ venue_id: venueId, key: `rota_published_${weekStartStr}`, value }, { onConflict: 'venue_id,key' })
}

// ── Venue closures (used by the rota's holiday/closure picker) ───────────────

export function deleteVenueClosure(id: string) {
  return supabase.from('venue_closures').delete().eq('id', id)
}
export function insertVenueClosures(rows: Record<string, unknown>[]) {
  return supabase.from('venue_closures').insert(rows)
}

// ── Shift swaps ──────────────────────────────────────────────────────────────

export function resolveShiftSwap(swapId: string, status: 'approved' | 'rejected') {
  return supabase.from('shift_swaps').update({ status, resolved_at: new Date().toISOString() }).eq('id', swapId)
}

// ── RPCs ─────────────────────────────────────────────────────────────────────

export function submitClockEditRequest(params: Record<string, unknown>) {
  return supabase.rpc('submit_clock_edit_request', params)
}
export function createSwapRequest(params: Record<string, unknown>) {
  return supabase.rpc('create_swap_request', params)
}
