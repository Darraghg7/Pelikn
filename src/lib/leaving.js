/**
 * Holiday owed to someone who is leaving.
 *
 * The rule (NI Working Time Regulations reg 14, and the GB equivalent):
 *
 *   owed = (a full year's holiday × the share of the leave year they worked)
 *          + holiday carried over into it
 *          − holiday already used this leave year
 *
 * The leave year is the venue's holiday year (lib/holidayYear) containing their
 * last day. The share runs from its start (or their start date, if later) to
 * their last day. Holiday carried over into that year (153) is added on top.
 *
 *   - Days-based staff: a full year is calculateEntitlementDays (or the
 *     manager's override); used is approved annual leave days + holiday
 *     already paid in days.
 *   - Zero-hours, Northern Ireland: a full year is 5.6 × their average week
 *     (last 12 weeks worked, up to their last day).
 *   - Zero-hours, GB: holiday builds up at 12.07% of hours worked, so what
 *     they have built up by their last day already is the earned amount.
 *
 * Leave booked after their last day doesn't count — they won't take it (it is
 * cancelled when their account is switched off). A booking that runs past
 * the last day counts only up to it.
 *
 * A negative result means they have taken more than they earned. That can
 * only be taken back from final pay if their contract says so.
 *
 * Pure, so it can be tested without a database.
 */
import { londonDateStr } from './time'
import {
  workedShifts, hoursByWeek, averageWeek, holidayUsed,
  HOLIDAY_WEEKS, GB_ACCRUAL_RATE, GB_CAP_HOURS,
} from './holiday'
import { holidayYearContaining, inHolidayYear } from './holidayYear'

/** @type {{ value: string, label: string }[]} — must match 152's CHECK. */
export const LEAVING_REASONS = [
  { value: 'resigned',        label: 'Resigned' },
  { value: 'end_of_contract', label: 'End of contract' },
  { value: 'dismissed',       label: 'Dismissed' },
  { value: 'redundancy',      label: 'Redundancy' },
  { value: 'retired',         label: 'Retired' },
  { value: 'other',           label: 'Other' },
]

/** What the manager ticks off. Rota shifts are handled by Pelikn, so they aren't here. */
export const LEAVING_CHECKLIST = [
  { key: 'payroll',  label: 'Final pay and holiday pay sent to payroll' },
  { key: 'property', label: 'Keys, uniform and equipment returned' },
]

const round1 = (n) => Math.round(n * 10) / 10
const round2 = (n) => Math.round(n * 100) / 100

const dayMs = (s) => Date.parse(`${s}T00:00:00Z`)
/** Days from `from` to `to`, counting both. */
function daysInclusive(from, to) {
  return Math.round((dayMs(to) - dayMs(from)) / 86_400_000) + 1
}
/** Days in their working pattern (Mon = 1 … Sun = 7; none set = Mon–Fri), as useLeaveBalance counts them. */
function workingDaysIn(from, to, workingDays) {
  const pattern = workingDays?.length ? workingDays : [1, 2, 3, 4, 5]
  let n = 0
  for (let t = dayMs(from); t <= dayMs(to); t += 86_400_000) {
    if (pattern.includes(new Date(t).getUTCDay() || 7)) n++
  }
  return n
}
function nextDay(s) {
  return new Date(dayMs(s) + 86_400_000).toISOString().slice(0, 10)
}

/**
 * Share of the holiday year worked by their last day: from the start of the
 * year (or `startDate` if later) to `lastDay`, over the days in the year.
 *
 * @param {string} lastDay
 * @param {string|null} [startDate]
 * @param {import('./holidayYear').HolidayYear} [holidayYear]  default: the January year containing lastDay
 */
export function leaveYearShare(lastDay, startDate = null, holidayYear = holidayYearContaining(lastDay)) {
  const from = startDate && startDate > holidayYear.start ? startDate : holidayYear.start
  if (from > lastDay) return 0
  return daysInclusive(from, lastDay) / daysInclusive(holidayYear.start, holidayYear.end)
}

/**
 * Leave as it stands on their last day: bookings starting after it dropped,
 * ones running past it cut off at it (recorded paid hours shared by days).
 */
export function leaveUpTo(requests, lastDay) {
  const out = []
  for (const r of requests) {
    if (r.start_date > lastDay) continue
    if (r.end_date <= lastDay) { out.push(r); continue }
    const kept = daysInclusive(r.start_date, lastDay) / daysInclusive(r.start_date, r.end_date)
    out.push({
      ...r,
      end_date: lastDay,
      paid_hours: r.paid_hours == null ? r.paid_hours : Number(r.paid_hours) * kept,
    })
  }
  return out
}

/**
 * Zero-hours leaver, in hours.
 *
 * @param {object} p
 * @param {'gb'|'ni'|null} p.region
 * @param {{start_date?: string|null, working_days?: number[], holiday_pay_eligible?: boolean}} p.staff
 * @param {{event_type: string, occurred_at: string}[]} p.events  clock events
 * @param {object[]} p.requests   approved annual leave
 * @param {{hours?: number|string|null}[]} [p.paidOut]  holiday already paid, for the leaving year
 * @param {{hours?: number|string|null}[]} [p.carriedOver]  carried into the leaving year
 * @param {string} p.lastDay  "yyyy-MM-dd"
 * @param {string} p.today    "yyyy-MM-dd", London
 * @param {import('./holidayYear').HolidayYear} [p.holidayYear]  the year containing lastDay
 * @param {Date}   [p.now]
 */
export function leaverHolidayHours({ region, staff, events, requests, paidOut = [], carriedOver = [], lastDay, today, holidayYear = holidayYearContaining(lastDay), now }) {
  if (staff?.holiday_pay_eligible === false) return { status: 'self_employed' }
  if (region !== 'gb' && region !== 'ni') return { status: 'needs_region' }

  const { shifts: all } = workedShifts(events, now)
  const shifts = all.filter(s => londonDateStr(s.start) <= lastDay)
  // Average up to their last week, or up to now while they're still working.
  const asOf = today <= lastDay ? today : nextDay(lastDay)
  const { avgWeekHours, weeksUsed } = averageWeek(hoursByWeek(shifts), asOf)

  let earned
  let fullYear = null
  let share = null
  if (region === 'gb') {
    const hours = shifts
      .filter(s => inHolidayYear(londonDateStr(s.start), holidayYear))
      .reduce((sum, s) => sum + s.hours, 0)
    earned = Math.min(hours * GB_ACCRUAL_RATE, GB_CAP_HOURS)
  } else {
    share = leaveYearShare(lastDay, staff?.start_date ?? null, holidayYear)
    fullYear = avgWeekHours == null ? 0 : HOLIDAY_WEEKS * avgWeekHours
    earned = fullYear * share
  }

  const carried = carriedOver.reduce((sum, c) => sum + (Number(c.hours) || 0), 0)
  const { used, estimated } = holidayUsed(leaveUpTo(requests, lastDay), {
    holidayYear,
    avgWeekHours,
    workingDays: staff?.working_days ?? [],
  })
  const paidOutHours = paidOut.reduce((sum, p) => sum + (Number(p.hours) || 0), 0)
  const usedTotal = used + paidOutHours

  return {
    status: 'ok',
    unit: 'hours',
    region,
    holidayYear,
    earned: round1(earned),
    carriedOver: round1(carried),
    used: round1(usedTotal),
    owed: round1(earned + carried - usedTotal),
    fullYear: fullYear == null ? null : round1(fullYear),
    share,
    avgWeekHours: avgWeekHours == null ? null : round1(avgWeekHours),
    weeksInAverage: weeksUsed,
    usedIsEstimate: estimated,
    noAverage: region === 'ni' && avgWeekHours == null,
  }
}

/**
 * Days-based leaver.
 *
 * @param {object} p
 * @param {number|null} p.entitlementDays  a full year's allowance (null when not eligible)
 * @param {{start_date: string, end_date: string, status?: string, leave_type?: string}[]} p.requests
 * @param {{days?: number|string|null}[]} [p.paidOut]
 * @param {{days?: number|string|null}[]} [p.carriedOver]
 * @param {number[]} [p.workingDays]
 * @param {string|null} [p.startDate]
 * @param {string} p.lastDay
 * @param {import('./holidayYear').HolidayYear} [p.holidayYear]  the year containing lastDay
 */
export function leaverHolidayDays({ entitlementDays, requests, paidOut = [], carriedOver = [], workingDays = [], startDate = null, lastDay, holidayYear = holidayYearContaining(lastDay) }) {
  if (entitlementDays == null) return { status: 'self_employed' }
  const yearStart = holidayYear.start
  const share = leaveYearShare(lastDay, startDate, holidayYear)
  const earned = entitlementDays * share

  let used = 0
  for (const r of leaveUpTo(requests, lastDay)) {
    if ((r.status && r.status !== 'approved') || (r.leave_type && r.leave_type !== 'annual')) continue
    if (r.end_date < yearStart) continue
    const from = r.start_date < yearStart ? yearStart : r.start_date
    used += workingDaysIn(from, r.end_date, workingDays)
  }
  used += paidOut.reduce((sum, p) => sum + (Number(p.days) || 0), 0)
  const carried = carriedOver.reduce((sum, c) => sum + (Number(c.days) || 0), 0)

  return {
    status: 'ok',
    unit: 'days',
    holidayYear,
    earned: round1(earned),
    carriedOver: round1(carried),
    used: round1(used),
    owed: round1(earned + carried - used),
    fullYear: entitlementDays,
    share,
  }
}

/**
 * Holiday pay for what is owed, in pounds, or null when there is no rate to
 * go on. Days are turned into hours with their contracted hours spread over
 * their working days.
 *
 * @param {{status: string, unit?: string, owed?: number}} position
 * @param {{hourlyRate?: number|null, contractedHours?: number|null, workingDays?: number[]}} pay
 */
export function leaverHolidayPay(position, { hourlyRate, contractedHours, workingDays } = {}) {
  if (!hourlyRate || position?.status !== 'ok') return null
  if (position.unit === 'hours') return round2(position.owed * hourlyRate)
  const daysPerWeek = workingDays?.length ? Math.min(workingDays.length, 7) : 5
  if (!contractedHours) return null
  return round2(position.owed * (contractedHours / daysPerWeek) * hourlyRate)
}
