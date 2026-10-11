/**
 * The holiday year: twelve months starting on the 1st of the month the venue
 * chose in Settings → Attendance (app_settings 'holiday_year_start_month',
 * 1 = January, the default).
 *
 * A holiday year is named by the calendar year it starts in — April 2026 to
 * March 2027 is 2026. That number is what leave_year means in
 * leave_entitlements, holiday_paid_out (150) and holiday_carry_over (153).
 *
 * @typedef {{ startYear: number, start: string, end: string, startMonth: number, label: string }} HolidayYear
 *   start / end are "yyyy-MM-dd", both inclusive.
 */
import { londonToday } from './time'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n) => String(n).padStart(2, '0')

function validMonth(m) {
  const n = Number(m)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1
}

/** The holiday year that starts in `startYear`. */
export function holidayYearStarting(startYear, startMonth = 1) {
  const m = validMonth(startMonth)
  const start = `${startYear}-${pad(m)}-01`
  // Day before the next start: day 0 of month m (1-based) a year on is the last day of month m-1.
  const endDate = new Date(Date.UTC(startYear + 1, m - 1, 0))
  const end = endDate.toISOString().slice(0, 10)
  const label = m === 1
    ? String(startYear)
    : `${MONTHS[m - 1]} ${startYear} – ${MONTHS[endDate.getUTCMonth()]} ${endDate.getUTCFullYear()}`
  return { startYear, start, end, startMonth: m, label }
}

/** The holiday year containing `dateStr` ("yyyy-MM-dd"). */
export function holidayYearContaining(dateStr, startMonth = 1) {
  const m = validMonth(startMonth)
  const [y, mo] = dateStr.split('-').map(Number)
  return holidayYearStarting(mo >= m ? y : y - 1, m)
}

/** The holiday year containing today (London). */
export function currentHolidayYear(startMonth = 1) {
  return holidayYearContaining(londonToday(), startMonth)
}

/** The holiday year before `hy`. */
export function previousHolidayYear(hy) {
  return holidayYearStarting(hy.startYear - 1, hy.startMonth)
}

/** Is `dateStr` ("yyyy-MM-dd") inside the holiday year? */
export function inHolidayYear(dateStr, hy) {
  return dateStr >= hy.start && dateStr <= hy.end
}
