/**
 * Holiday pay allocations (migration 148): the hours a manager pays for each
 * day of approved annual leave, set from the timesheet. Those exact hours are
 * what the timesheet pays and what comes off a zero-hours person's accrued
 * balance; days not yet allocated are estimated at their average shift.
 */
import { eachDayOfInterval, format, getDay, parseISO } from 'date-fns'
import { supabase } from '../supabase'
import { DEFAULT_WORKING_DAYS } from '../../hooks/useLeaveBalance'

// The table not existing yet (148 not applied) — PostgREST's "not in the
// schema cache", or Postgres's "undefined table". Callers fall back to the
// old estimated holiday pay rather than failing.
function isMissingTable(error) {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

// { data, available } — available is false until migration 148 is applied
export async function fetchHolidayAllocations({ venueId = undefined, staffIds = undefined, from, to }) {
  let q = supabase
    .from('holiday_pay_allocations')
    .select('id, staff_id, time_off_request_id, leave_date, hours')
    .gte('leave_date', from)
    .lte('leave_date', to)
  if (venueId)  q = q.eq('venue_id', venueId)
  if (staffIds) q = q.in('staff_id', staffIds)
  const { data, error } = await q
  if (error) {
    if (isMissingTable(error)) return { data: [], available: false }
    throw error
  }
  return { data: data ?? [], available: true }
}

// rows: [{ venue_id, staff_id, time_off_request_id, leave_date, hours, allocated_by }]
export function allocateHolidayPay(rows) {
  return supabase.from('holiday_pay_allocations').insert(rows)
}

export function removeHolidayAllocations(ids) {
  return supabase.from('holiday_pay_allocations').delete().in('id', ids)
}

function isWorkingDay(date, workingDays) {
  const pattern = workingDays?.length > 0 ? workingDays : DEFAULT_WORKING_DAYS
  const dow = getDay(date)
  return pattern.includes(dow === 0 ? 7 : dow)
}

/**
 * Every day of the given approved requests that falls inside [from, to], with
 * whether it is on the person's working pattern and any hours allocated to it.
 * requests: [{ id, staff_id, start_date, end_date }]
 * Returns [{ requestId, staffId, date, isWorkingDay, allocationId, allocatedHours }]
 */
export function leaveDaysInRange(requests, allocations, workingDays, from, to) {
  const byDay = new Map((allocations ?? []).map(a => [`${a.time_off_request_id}|${a.leave_date}`, a]))
  const days = []
  for (const r of requests) {
    const start = r.start_date < from ? from : r.start_date
    const end   = r.end_date   > to   ? to   : r.end_date
    if (end < start) continue
    for (const d of eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })) {
      const date = format(d, 'yyyy-MM-dd')
      const alloc = byDay.get(`${r.id}|${date}`)
      days.push({
        requestId:      r.id,
        staffId:        r.staff_id,
        date,
        isWorkingDay:   isWorkingDay(d, workingDays),
        allocationId:   alloc?.id ?? null,
        allocatedHours: alloc ? Number(alloc.hours) : null,
      })
    }
  }
  return days
}

// Holiday hours used: what was allocated, plus an estimate (average shift) for
// booked working days nobody has allocated yet.
export function holidayHoursUsed(days, avgDailyHours) {
  const total = days.reduce((sum, d) => {
    if (d.allocatedHours != null) return sum + d.allocatedHours
    return d.isWorkingDay ? sum + avgDailyHours : sum
  }, 0)
  return Math.round(total * 10) / 10
}

/**
 * A zero-hours person's holiday hours used so far this holiday year, across
 * every approved annual leave day — allocated hours where a manager has set
 * them, their average shift for the rest.
 * leaveYear: { from, to } from lib/leaveYear
 */
export async function fetchHolidayHoursUsed({ staffId, workingDays, leaveYear, avgDailyHours }) {
  const { from, to } = leaveYear
  const [{ data: reqs, error }, allocs] = await Promise.all([
    supabase.from('time_off_requests')
      .select('id, staff_id, start_date, end_date')
      .eq('staff_id', staffId)
      .eq('status', 'approved')
      .eq('leave_type', 'annual')
      .lte('start_date', to)
      .gte('end_date', from),
    fetchHolidayAllocations({ staffIds: [staffId], from, to }),
  ])
  if (error) throw error
  return holidayHoursUsed(leaveDaysInRange(reqs ?? [], allocs.data, workingDays, from, to), avgDailyHours)
}

/*
 * Carry-over and pay-outs (holiday_balance_adjustments, also migration 148).
 * carry_over adds unused hours brought forward into a holiday year; payout
 * takes hours off and pays them on the timesheet on pay_date.
 */
const ADJUSTMENT_COLUMNS = 'id, staff_id, leave_year, kind, hours, pay_date, note, created_at'

// One holiday year's adjustments, by its start year. { data, available }
export async function fetchBalanceAdjustments({ staffIds, leaveYear }) {
  const { data, error } = await supabase
    .from('holiday_balance_adjustments')
    .select(ADJUSTMENT_COLUMNS)
    .in('staff_id', staffIds)
    .eq('leave_year', leaveYear)
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) return { data: [], available: false }
    throw error
  }
  return { data: data ?? [], available: true }
}

// Pay-outs paid between two dates — what the timesheet adds to holiday pay
export async function fetchPayouts({ venueId, from, to }) {
  const { data, error } = await supabase
    .from('holiday_balance_adjustments')
    .select(ADJUSTMENT_COLUMNS)
    .eq('venue_id', venueId)
    .eq('kind', 'payout')
    .gte('pay_date', from)
    .lte('pay_date', to)
  if (error) {
    if (isMissingTable(error)) return { data: [], available: false }
    throw error
  }
  return { data: data ?? [], available: true }
}

// row: { venue_id, staff_id, leave_year, kind, hours, pay_date?, note?, created_by }
export function addBalanceAdjustment(row) {
  return supabase.from('holiday_balance_adjustments').insert(row)
}

export function removeBalanceAdjustment(id) {
  return supabase.from('holiday_balance_adjustments').delete().eq('id', id)
}

// { carriedOver, paidOut } hours from a list of adjustments
export function adjustmentTotals(adjustments) {
  let carriedOver = 0, paidOut = 0
  for (const a of adjustments ?? []) {
    if (a.kind === 'carry_over') carriedOver += Number(a.hours)
    if (a.kind === 'payout')     paidOut     += Number(a.hours)
  }
  return { carriedOver: Math.round(carriedOver * 100) / 100, paidOut: Math.round(paidOut * 100) / 100 }
}

// Zero-hours hours left: earned + carried over − used − paid out
export function zeroHoursLeft({ accrued, used, carriedOver = 0, paidOut = 0 }) {
  return Math.round((accrued + carriedOver - used - paidOut) * 10) / 10
}
