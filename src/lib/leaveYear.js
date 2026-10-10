/**
 * The venue's holiday year — when allowances reset and accrual starts again.
 * Set per venue (leave_year_start_month, 1 = January … 12 = December) so it
 * can match the accountant's year; defaults to the calendar year.
 */
import { format, subDays } from 'date-fns'

const pad = (n) => String(n).padStart(2, '0')

// The holiday year that `date` falls in:
//   startYear — the year it began in (also the key for leave_entitlements)
//   from, to  — first and last day, 'yyyy-MM-dd'
//   label     — "2026", or "2026/27" when it doesn't start in January
export function leaveYearFor(date = new Date(), startMonth = 1) {
  const month     = Number.isInteger(startMonth) && startMonth >= 1 && startMonth <= 12 ? startMonth : 1
  const startYear = date.getMonth() + 1 >= month ? date.getFullYear() : date.getFullYear() - 1
  const from      = `${startYear}-${pad(month)}-01`
  const to        = format(subDays(new Date(startYear + 1, month - 1, 1), 1), 'yyyy-MM-dd')
  const label     = month === 1 ? String(startYear) : `${startYear}/${String(startYear + 1).slice(2)}`
  return { startYear, from, to, label }
}

// Same, for a 'yyyy-MM-dd' date string
export function leaveYearForDateStr(dateStr, startMonth = 1) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return leaveYearFor(new Date(y, m - 1, d), startMonth)
}
