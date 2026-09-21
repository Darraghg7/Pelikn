/**
 * Shared constants and pure helpers for the time-off screens.
 *
 * Kept next to the page rather than in lib/api/timeOff.ts because these are
 * presentation concerns (Tailwind class maps, day-count labels) — the API
 * module stays free of UI.
 */
import { eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns'

export const LEAVE_TYPES = [
  { value: 'annual',  label: 'Annual Leave' },
  { value: 'unpaid',  label: 'Unpaid Leave' },
  { value: 'other',   label: 'Other' },
]

export const LEAVE_TYPE_COLOURS = {
  annual:  'bg-brand/10 text-brand',
  unpaid:  'bg-charcoal/8 dark:bg-white/8 text-charcoal/50 dark:text-white/40',
  other:   'bg-charcoal/8 dark:bg-white/8 text-charcoal/50 dark:text-white/40',
}

export const STATUS_COLOURS = {
  pending:   'bg-warning/10 text-warning border-warning/20',
  approved:  'bg-success/10 text-success border-success/20',
  rejected:  'bg-danger/10 text-danger border-danger/20',
  cancelled: 'bg-charcoal/5 dark:bg-white/5 text-charcoal/45 dark:text-white/40 border-charcoal/10 dark:border-white/10',
}

export const leaveTypeLabel = (value) => LEAVE_TYPES.find(t => t.value === value)?.label ?? value

export function getRequestsForDay(requests, day) {
  if (!day) return []
  return requests.filter(r =>
    isWithinInterval(day, { start: parseISO(r.start_date), end: parseISO(r.end_date) })
  )
}

export function fmtDays(n) {
  if (n === null || n === undefined) return '—'
  return n === 1 ? '1 day' : `${n} days`
}

export function maxStaffOffInRange(requests, startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0
  const days = eachDayOfInterval({ start: parseISO(startDateStr), end: parseISO(endDateStr) })
  return days.reduce((max, day) => Math.max(max, getRequestsForDay(requests, day).length), 0)
}
