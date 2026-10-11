/**
 * Reads behind zero-hours holiday balances (lib/holiday.js does the sums).
 *
 * Two things the old useZeroHoursAccrual got wrong are handled here:
 *
 * - Supabase returns at most 1,000 rows a request and drops the rest without
 *   an error. A venue's zero-hours clock events pass that by spring, after
 *   which balances silently stopped growing. Every read here pages.
 *
 * - paid_hours (and the is_manual_entry grant) arrive with migration 149.
 *   Selecting a column that isn't there fails the whole read, so until 149 is
 *   applied the request reads fall back to the old column list and every
 *   request counts as "estimated".
 */
import { supabase } from '../supabase'
import { throwIfError } from '../queryErrors'
import { paidShiftHours } from '../../hooks/useShifts'

const PAGE = 1000

/** Read every row a query matches, a page at a time. `build()` must return a fresh, ordered query. */
export async function fetchAllPages(build) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const res = await build().range(from, from + PAGE - 1)
    throwIfError(res)
    const page = res.data ?? []
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

// 42703 undefined column; 42501 permission denied (column exists, no grant yet).
const isMissingColumn = (e) => e && (e.code === '42703' || e.code === '42501')

/**
 * Run a read that asks for 149's columns, falling back to one without them.
 * `build(extraColumns)` gets ', paid_hours, is_manual_entry' or ''.
 */
export async function withPaidHoursColumns(build) {
  try {
    return await build(', paid_hours, is_manual_entry')
  } catch (e) {
    if (!isMissingColumn(e)) throw e
    return build('')
  }
}

/**
 * Clock events for these people from `sinceDate` (London "yyyy-MM-dd").
 * Starts a day early so a shift that began the evening before isn't cut in half.
 */
export function fetchClockEvents(staffIds, sinceDate) {
  const [y, m, d] = sinceDate.split('-').map(Number)
  const since = new Date(Date.UTC(y, m - 1, d - 1)).toISOString()
  return fetchAllPages(() => supabase
    .from('clock_events')
    .select('id, staff_id, event_type, occurred_at')
    .in('staff_id', staffIds)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true })
    .order('id', { ascending: true }))
}

/**
 * Each person's first clock-in on record, `{ [staffId]: occurred_at }`, for
 * guessing a start date when none is saved. One tiny read per person: clock
 * events are only fetched from the start of the holiday year, which doesn't
 * reach back to when long-serving staff started.
 */
export async function fetchFirstClockIns(staffIds) {
  const firsts = await Promise.all(staffIds.map(id => firstClockIn(q => q.eq('staff_id', id))))
  const out = {}
  staffIds.forEach((id, i) => { if (firsts[i]) out[id] = firsts[i] })
  return out
}

/** The venue's first clock-in on record (occurred_at), or null — when it started clocking in on Pelikn. */
export function fetchVenueFirstClockIn(venueId) {
  return firstClockIn(q => q.eq('venue_id', venueId))
}

async function firstClockIn(filter) {
  const res = await filter(supabase.from('clock_events').select('occurred_at'))
    .eq('event_type', 'clock_in')
    .order('occurred_at', { ascending: true })
    .limit(1)
  throwIfError(res)
  return res.data?.[0]?.occurred_at ?? null
}

/**
 * Approved annual leave for these people touching the date range — a holiday
 * year's `start` / `end` ("yyyy-MM-dd", inclusive).
 */
export function fetchAnnualLeave(staffIds, { start, end }) {
  return withPaidHoursColumns(extra => fetchAllPages(() => supabase
    .from('time_off_requests')
    .select(`id, staff_id, start_date, end_date, status, leave_type${extra}`)
    .in('staff_id', staffIds)
    .eq('status', 'approved')
    .eq('leave_type', 'annual')
    .lte('start_date', end)
    .gte('end_date', start)
    .order('start_date', { ascending: true })
    .order('id', { ascending: true })))
}

/**
 * Paid rota hours per person per day, for suggesting holiday pay:
 * `{ [staffId]: { 'yyyy-MM-dd': hours } }`. Breaks are taken off the same way
 * the rota and timesheets cost a shift.
 */
export async function fetchRotaHours(venueId, staffIds, from, to, { breakMins = 30, under18 = new Set() } = {}) {
  const rows = await fetchAllPages(() => supabase
    .from('shifts')
    .select('id, staff_id, shift_date, start_time, end_time')
    .eq('venue_id', venueId)
    .in('staff_id', staffIds)
    .gte('shift_date', from)
    .lte('shift_date', to)
    .order('shift_date', { ascending: true })
    .order('id', { ascending: true }))
  const out = {}
  for (const s of rows) {
    if (!s.start_time || !s.end_time) continue
    const hours = paidShiftHours(s.start_time, s.end_time, under18.has(s.staff_id), breakMins)
    const day = (out[s.staff_id] ??= {})
    day[s.shift_date] = (day[s.shift_date] ?? 0) + hours
  }
  return out
}

// PGRST205 table not found (migration 150 not applied yet); 42P01 undefined table.
const isMissingTable = (e) => e && (e.code === 'PGRST205' || e.code === '42P01')

/**
 * Holiday already paid outside a dated booking (migration 150) for the holiday
 * year starting in `leaveYear` (lib/holidayYear: HolidayYear.startYear).
 * Before 150 is applied there is no table, which reads as "none recorded".
 */
export function fetchPaidOut(staffIds, leaveYear) {
  return fetchLeaveYearRows('holiday_paid_out', 'id, staff_id, leave_year, hours, days, paid_on, note, created_at', staffIds, leaveYear)
}

/**
 * Holiday carried over into the holiday year starting in `leaveYear`
 * (migration 153), with who recorded it. Before 153 is applied there is no
 * table, which reads as "none".
 */
export function fetchCarryOver(staffIds, leaveYear) {
  return fetchLeaveYearRows('holiday_carry_over', 'id, staff_id, leave_year, hours, days, note, created_at, created_by, creator:created_by(name)', staffIds, leaveYear)
}

async function fetchLeaveYearRows(table, columns, staffIds, leaveYear) {
  try {
    return await fetchAllPages(() => supabase
      .from(table)
      .select(columns)
      .in('staff_id', staffIds)
      .eq('leave_year', leaveYear)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }))
  } catch (e) {
    if (isMissingTable(e)) return []
    throw e
  }
}

/** A manager-set days allowance for one person's holiday year (leave_entitlements), or null. */
export async function fetchEntitlementOverride(staffId, leaveYear) {
  const res = await supabase
    .from('leave_entitlements')
    .select('override_days')
    .eq('staff_id', staffId)
    .eq('leave_year', leaveYear)
    .maybeSingle()
  throwIfError(res)
  return res.data?.override_days ?? null
}

export function addCarryOver(row) {
  return supabase.from('holiday_carry_over').insert(row)
}

export function removeCarryOver(id) {
  return supabase.from('holiday_carry_over').delete().eq('id', id)
}

/**
 * Holiday paid out through a timesheet (migration 154's on_timesheet flag) on
 * dates between `from` and `to` ("yyyy-MM-dd", inclusive). Before 154 there is
 * no flag, which reads as none — older paid-out rows are payroll already paid
 * elsewhere and must never be added to pay.
 */
export async function fetchTimesheetPayouts(venueId, from, to) {
  try {
    return await fetchAllPages(() => supabase
      .from('holiday_paid_out')
      .select('id, staff_id, leave_year, hours, paid_on, note')
      .eq('venue_id', venueId)
      .eq('on_timesheet', true)
      .gte('paid_on', from)
      .lte('paid_on', to)
      .order('paid_on', { ascending: true })
      .order('id', { ascending: true }))
  } catch (e) {
    if (isMissingTable(e) || isMissingColumn(e)) return []
    throw e
  }
}

export function addPaidOut(row) {
  return supabase.from('holiday_paid_out').insert(row)
}

export function removePaidOut(id) {
  return supabase.from('holiday_paid_out').delete().eq('id', id)
}
