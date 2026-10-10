/**
 * Holiday booked in hours (migration 148).
 *
 * A time-off request carries the holiday hours it uses and pays — filled in
 * when booking (pre-filled from the person's usual day), adjustable by the
 * manager when approving. Approving is the decision to pay it: the timesheet
 * pays those hours in the week(s) the leave falls in, and they come off the
 * person's accrued balance. Pending requests already count against the
 * balance, so it moves the moment someone books.
 *
 * Requests from before 148 (hours = null) are estimated from their working
 * days × usual hours a day, exactly as holiday was counted until now.
 */
import { eachDayOfInterval, format, getDay, parseISO } from 'date-fns'
import { supabase } from '../supabase'
import { DEFAULT_WORKING_DAYS } from '../../hooks/useLeaveBalance'

// Until 148 is applied the columns don't exist, and naming one in a select
// fails the whole query — so callers ask once and leave them out. Cached for
// the session; a failed probe isn't cached, so it's asked again next time.
let hoursColumnProbe = null
export function hasHoursColumn() {
  if (!hoursColumnProbe) {
    hoursColumnProbe = supabase.from('time_off_requests').select('hours').limit(1)
      .then(({ error }) => {
        if (error) hoursColumnProbe = null
        return !error
      })
  }
  return hoursColumnProbe
}

const round1 = (n) => Math.round(n * 10) / 10

function isWorkingDay(date, workingDays) {
  const pattern = workingDays?.length > 0 ? workingDays : DEFAULT_WORKING_DAYS
  const dow = getDay(date)
  return pattern.includes(dow === 0 ? 7 : dow)
}

function daysOf(r) {
  return eachDayOfInterval({ start: parseISO(r.start_date), end: parseISO(r.end_date) })
}

// The holiday hours a whole request uses: what was booked, or for older
// requests their working days × usual hours a day (null when that's unknown)
export function requestHours(r, workingDays, dayHours) {
  if (r.hours != null) return Number(r.hours)
  if (dayHours == null) return null
  return round1(daysOf(r).filter(d => isWorkingDay(d, workingDays)).length * dayHours)
}

/**
 * The share of a request's hours that falls between two 'yyyy-MM-dd' dates
 * (a pay period, or a holiday year). Split by working days; by calendar days
 * if the leave covers none of them — e.g. holiday pay given for a week
 * someone wasn't rostered.
 */
export function requestHoursInRange(r, workingDays, dayHours, from, to) {
  const total = requestHours(r, workingDays, dayHours)
  if (!total) return 0
  if (r.start_date >= from && r.end_date <= to) return total
  const days    = daysOf(r)
  const inside  = (d) => { const s = format(d, 'yyyy-MM-dd'); return s >= from && s <= to }
  const working = days.filter(d => isWorkingDay(d, workingDays))
  const basis   = working.length ? working : days
  return round1(total * basis.filter(inside).length / basis.length)
}

// Hours of a list of requests inside [from, to]
export function hoursInRange(requests, workingDays, dayHours, from, to) {
  return round1(requests.reduce((sum, r) => sum + requestHoursInRange(r, workingDays, dayHours, from, to), 0))
}

// Zero-hours hours left: earned + carried over − approved − awaiting approval
export function zeroHoursLeft({ accrued, carriedOver = 0, approved = 0, pending = 0 }) {
  return round1(accrued + carriedOver - approved - pending)
}

// Unused hours brought forward into a holiday year (leave_entitlements row)
export function saveCarryOver({ venueId, staffId, leaveYear, hours }) {
  return supabase.from('leave_entitlements').upsert(
    { venue_id: venueId, staff_id: staffId, leave_year: leaveYear, carry_over_hours: hours, updated_at: new Date().toISOString() },
    { onConflict: 'staff_id,leave_year' },
  )
}
