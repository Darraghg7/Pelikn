/**
 * Holiday for staff without fixed hours (employment_type 'zero_hours').
 *
 * Fixed-pattern staff get a days-based allowance (useLeaveBalance's
 * calculateEntitlementDays) and are unaffected by anything here.
 *
 * The rule depends on where the venue is, so it is a venue setting
 * (app_settings 'holiday_region'), with no default — the owner must choose:
 *
 *   'gb'  England, Scotland and Wales. Holiday builds up at 12.07% of hours
 *         worked (the irregular-hours rule for leave years from April 2024).
 *
 *   'ni'  Northern Ireland, which did not adopt that rule. Following Harpur
 *         Trust v Brazel, a worker employed all year gets the full 5.6 weeks,
 *         each week worth their average week over the last 12 weeks they
 *         actually worked (weeks with no work are skipped). In their first year
 *         it builds up a twelfth per month.
 *
 * Holiday taken is counted in hours: what the manager recorded as paid
 * (time_off_requests.paid_hours), or — for older requests with nothing
 * recorded — an estimate from the person's average week, flagged as such.
 * Only approved 'annual' leave counts. 'unavailable' is never holiday.
 *
 * Everything here is pure so it can be tested without a database; the hook
 * that feeds it is useHolidayBalances.
 */
import { londonDateStr } from './time'

export const HOLIDAY_WEEKS        = 5.6
export const GB_ACCRUAL_RATE      = 0.1207
export const NI_REFERENCE_WEEKS   = 12
/** How far back to look for the NI reference weeks. */
export const NI_LOOKBACK_WEEKS    = 52
/** GB cap: 5.6 weeks of a 40-hour week. Rarely reached; stops a data error running away. */
export const GB_CAP_HOURS         = 224

/** @type {{ value: 'gb' | 'ni', label: string }[]} */
export const HOLIDAY_REGIONS = [
  { value: 'gb', label: 'England, Scotland or Wales' },
  { value: 'ni', label: 'Northern Ireland' },
]

/** Repeats of the same event within this window are retries, not new events (see 106). */
const DUPLICATE_WINDOW_MS = 120_000
/** An open shift older than this has a missing clock-out rather than being in progress. */
const OPEN_SHIFT_LIMIT_MS = 18 * 3_600_000

const round1 = (n) => Math.round(n * 10) / 10

/**
 * Turn one person's clock events into shifts.
 *
 * A clock_in that is followed by another clock_in (or is still open long after
 * it began) has no clock-out. Its completed stretches before a break still
 * count; the rest can't be known, so the shift is reported in `missingClockOut`
 * for a manager to fix on the timesheet.
 *
 * @param {{event_type: string, occurred_at: string}[]} events  any order
 * @param {Date} [now]
 * @returns {{ shifts: {start: string, hours: number}[], missingClockOut: string[] }}
 */
export function workedShifts(events, now = new Date()) {
  const sorted = [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const shifts = []
  const missingClockOut = []

  let shift = null          // { start, hours }
  let segmentFrom = null    // Date while the clock is running
  let last = null           // previous kept event, for de-duplication

  const closeSegment = (at) => {
    if (shift && segmentFrom) shift.hours += Math.max(0, at.getTime() - segmentFrom.getTime()) / 3_600_000
    segmentFrom = null
  }
  const abandon = () => {
    // Clock-in never closed: keep finished stretches, drop the open one.
    missingClockOut.push(shift.start)
    shifts.push(shift)
    shift = null
    segmentFrom = null
  }

  for (const ev of sorted) {
    const at = new Date(ev.occurred_at)
    if (Number.isNaN(at.getTime())) continue
    if (last && last.event_type === ev.event_type && at.getTime() - last.at.getTime() < DUPLICATE_WINDOW_MS) continue
    last = { event_type: ev.event_type, at }

    switch (ev.event_type) {
      case 'clock_in':
        if (shift) abandon()
        shift = { start: ev.occurred_at, hours: 0 }
        segmentFrom = at
        break
      case 'break_start':
        closeSegment(at)
        break
      case 'break_end':
        if (shift && !segmentFrom) segmentFrom = at
        break
      case 'clock_out':
        if (!shift) break
        closeSegment(at)
        shifts.push(shift)
        shift = null
        break
      default:
        break
    }
  }

  if (shift) {
    if (now.getTime() - new Date(shift.start).getTime() > OPEN_SHIFT_LIMIT_MS) abandon()
    // otherwise still on shift: not counted yet, not a problem
  }

  return {
    // Exact hours: rounding each shift first drifts the average (6.85 → 6.9 a shift)
    shifts: shifts.map(s => ({ start: s.start, hours: s.hours })),
    missingClockOut,
  }
}

/** Monday of the London week containing `dateStr` ("yyyy-MM-dd"), as "yyyy-MM-dd". */
export function weekStarting(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d))
  const offset = (day.getUTCDay() + 6) % 7 // Mon = 0
  day.setUTCDate(day.getUTCDate() - offset)
  return day.toISOString().slice(0, 10)
}

/** Hours worked per London week, keyed by the week's Monday. */
export function hoursByWeek(shifts) {
  const weeks = new Map()
  for (const s of shifts) {
    const wk = weekStarting(londonDateStr(s.start))
    weeks.set(wk, (weeks.get(wk) ?? 0) + s.hours)
  }
  return weeks
}

/**
 * Average week over the last `NI_REFERENCE_WEEKS` weeks with any work,
 * finished weeks only, looking back at most `NI_LOOKBACK_WEEKS`.
 * @returns {{ avgWeekHours: number|null, weeksUsed: number }}
 */
export function averageWeek(weeks, today) {
  const thisWeek = weekStarting(today)
  const [y, m, d] = thisWeek.split('-').map(Number)
  const earliest = new Date(Date.UTC(y, m - 1, d - 7 * NI_LOOKBACK_WEEKS)).toISOString().slice(0, 10)
  const worked = [...weeks.entries()]
    .filter(([wk, h]) => h > 0 && wk < thisWeek && wk >= earliest)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, NI_REFERENCE_WEEKS)
  if (!worked.length) return { avgWeekHours: null, weeksUsed: 0 }
  const total = worked.reduce((sum, [, h]) => sum + h, 0)
  return { avgWeekHours: total / worked.length, weeksUsed: worked.length }
}

/** Whole months from `fromStr` to `toStr`, counting the month you start in. */
function monthsStarted(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  const [ty, tm, td] = toStr.split('-').map(Number)
  let months = (ty - fy) * 12 + (tm - fm)
  if (td < fd) months -= 1
  return Math.max(0, months) + 1
}

/**
 * Holiday hours available this leave year (calendar year).
 *
 * @param {object} p
 * @param {'gb'|'ni'} p.region
 * @param {{start: string, hours: number}[]} p.shifts
 * @param {number} p.year
 * @param {string} p.today         "yyyy-MM-dd", London
 * @param {string|null} [p.startDate]  staff.start_date
 */
export function holidayAllowance({ region, shifts, year, today, startDate }) {
  const weeks = hoursByWeek(shifts)
  const { avgWeekHours, weeksUsed } = averageWeek(weeks, today)
  const yearStart = `${year}-01-01`

  if (region === 'gb') {
    const hoursThisYear = shifts
      .filter(s => londonDateStr(s.start).startsWith(String(year)))
      .reduce((sum, s) => sum + s.hours, 0)
    return {
      allowance: round1(Math.min(hoursThisYear * GB_ACCRUAL_RATE, GB_CAP_HOURS)),
      hoursThisYear: round1(hoursThisYear),
      avgWeekHours: avgWeekHours == null ? null : round1(avgWeekHours),
      weeksUsed,
      firstYear: false,
    }
  }

  // Northern Ireland
  if (avgWeekHours == null) {
    return { allowance: 0, hoursThisYear: null, avgWeekHours: null, weeksUsed: 0, firstYear: false }
  }
  let allowance = HOLIDAY_WEEKS * avgWeekHours
  let firstYear = false
  if (startDate && startDate > yearStart && startDate <= today) {
    // Joined this leave year: the year's share, built up a twelfth a month.
    firstYear = true
    const startMonth = Number(startDate.slice(5, 7))
    const share   = (13 - startMonth) / 12
    const accrued = Math.min(12, monthsStarted(startDate, today)) / 12
    allowance = allowance * Math.min(share, accrued)
  }
  return {
    allowance: round1(allowance),
    hoursThisYear: null,
    avgWeekHours: round1(avgWeekHours),
    weeksUsed,
    firstYear,
  }
}

function daysBetween(fromStr, toStr) {
  return Math.round((Date.parse(`${toStr}T00:00:00Z`) - Date.parse(`${fromStr}T00:00:00Z`)) / 86_400_000) + 1
}

function daysInPattern(fromStr, toStr, workingDays) {
  let n = 0
  const end = Date.parse(`${toStr}T00:00:00Z`)
  for (let t = Date.parse(`${fromStr}T00:00:00Z`); t <= end; t += 86_400_000) {
    const dow = new Date(t).getUTCDay() || 7 // Mon = 1 … Sun = 7
    if (workingDays.includes(dow)) n++
  }
  return n
}

/**
 * Estimated holiday hours for leave with nothing recorded: a full week off is
 * worth one average week. With a working pattern, each pattern day is an even
 * share of the week; without one, each calendar day is a seventh.
 */
export function estimateLeaveHours(fromStr, toStr, avgWeekHours, workingDays) {
  if (!avgWeekHours || toStr < fromStr) return 0
  if (workingDays?.length) {
    return daysInPattern(fromStr, toStr, workingDays) * (avgWeekHours / workingDays.length)
  }
  return daysBetween(fromStr, toStr) * (avgWeekHours / 7)
}

/**
 * Holiday hours used this year by approved annual leave (taken or booked).
 * A request crossing the year boundary counts only its days in `year`; a
 * recorded paid_hours is split by the share of days that fall in the year.
 *
 * @returns {{ used: number, estimated: boolean }}
 */
export function holidayUsed(requests, { year, avgWeekHours, workingDays }) {
  const yStart = `${year}-01-01`
  const yEnd   = `${year}-12-31`
  let used = 0
  let estimated = false
  for (const r of requests) {
    if (r.status !== 'approved' || r.leave_type !== 'annual') continue
    if (r.end_date < yStart || r.start_date > yEnd) continue
    const from = r.start_date < yStart ? yStart : r.start_date
    const to   = r.end_date   > yEnd   ? yEnd   : r.end_date
    if (r.paid_hours != null) {
      used += Number(r.paid_hours) * (daysBetween(from, to) / daysBetween(r.start_date, r.end_date))
    } else {
      used += estimateLeaveHours(from, to, avgWeekHours, workingDays)
      estimated = true
    }
  }
  return { used: round1(used), estimated }
}

/**
 * One zero-hours person's holiday position.
 *
 * Returns `{ status }` first: 'self_employed' (no statutory holiday),
 * 'needs_region' (the venue hasn't said where it is), or 'ok' with figures.
 * `balance` goes negative when more has been taken than earned — that is
 * shown, not hidden.
 *
 * `paidOut` is holiday already paid outside a dated booking (migration 150);
 * its hours count as used.
 */
export function zeroHoursHoliday({ region, staff, events, requests, paidOut = [], year, today, now }) {
  if (staff?.holiday_pay_eligible === false) return { status: 'self_employed' }
  if (region !== 'gb' && region !== 'ni') return { status: 'needs_region' }

  const { shifts, missingClockOut } = workedShifts(events, now)
  const a = holidayAllowance({ region, shifts, year, today, startDate: staff?.start_date ?? null })
  const { used, estimated } = holidayUsed(requests, {
    year,
    avgWeekHours: a.avgWeekHours,
    workingDays: staff?.working_days ?? [],
  })
  const paidOutHours = round1(paidOut.reduce((sum, p) => sum + (Number(p.hours) || 0), 0))
  const usedTotal = round1(used + paidOutHours)

  return {
    status: 'ok',
    region,
    allowance: a.allowance,
    used: usedTotal,
    paidOutHours,
    usedIsEstimate: estimated,
    balance: round1(a.allowance - usedTotal),
    avgWeekHours: a.avgWeekHours,
    weeksInAverage: a.weeksUsed,
    hoursThisYear: a.hoursThisYear,
    firstYear: a.firstYear,
    missingClockOuts: missingClockOut.filter(s => londonDateStr(s).startsWith(String(year))).length,
  }
}

/**
 * How many holiday hours a request is worth, day by day:
 *
 *   - a day they were already on the rota for → that shift's paid hours
 *     (`rotaHoursByDate`, "yyyy-MM-dd" → hours). Approved leave keeps people
 *     off the rota, so this only happens when they booked after it was made.
 *   - any other day in their usual working days (or any day, if none are
 *     set) → an even share of their average week.
 *   - a day outside their usual working days → nothing.
 *
 * @returns {{ hours: number, rotaHours: number, rotaDays: number, averageHours: number, averageDays: number } | null}
 *   null when there is nothing to go on (no average week and no rota shifts).
 */
export function leaveHoursBreakdown(request, avgWeekHours, workingDays, rotaHoursByDate = {}) {
  const { start_date: from, end_date: to } = request
  if (!from || !to || to < from) return null
  let rotaHours = 0, rotaDays = 0, averageHours = 0, averageDays = 0
  const perDay = avgWeekHours ? avgWeekHours / (workingDays?.length || 7) : 0
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10)
    if (rotaHoursByDate[day] != null) {
      rotaHours += rotaHoursByDate[day]
      rotaDays++
      continue
    }
    const dow = new Date(t).getUTCDay() || 7
    if (perDay && (!workingDays?.length || workingDays.includes(dow))) {
      averageHours += perDay
      averageDays++
    }
  }
  if (!avgWeekHours && !rotaDays) return null
  return {
    hours: round1(rotaHours + averageHours),
    rotaHours: round1(rotaHours),
    rotaDays,
    averageHours: round1(averageHours),
    averageDays,
  }
}

/** Suggested hours to pay for a request: rota shifts where there are any, else the average week. */
export function suggestedPaidHours(request, avgWeekHours, workingDays, rotaHoursByDate = {}) {
  return leaveHoursBreakdown(request, avgWeekHours, workingDays, rotaHoursByDate)?.hours ?? null
}
