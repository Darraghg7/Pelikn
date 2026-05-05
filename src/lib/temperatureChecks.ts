import type { CheckableItem } from '../types'

export const CHECK_DAYS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 0, short: 'Sun', label: 'Sunday' },
] as const

export const CHECK_PERIODS = [
  { value: 'am', label: 'AM' },
  { value: 'pm', label: 'PM' },
] as const

export const DEFAULT_CHECK_DAYS  = [0, 1, 2, 3, 4, 5, 6] as const
export const DEFAULT_CHECK_PERIODS = ['am', 'pm'] as const

export function getCheckDays(item: CheckableItem): number[] {
  return Array.isArray(item?.check_days) && item.check_days.length > 0
    ? item.check_days
    : [...DEFAULT_CHECK_DAYS]
}

export function getRequiredPeriods(item: CheckableItem): string[] {
  return Array.isArray(item?.required_periods) && item.required_periods.length > 0
    ? item.required_periods
    : [...DEFAULT_CHECK_PERIODS]
}

export function isCheckRequired(item: CheckableItem, date: Date = new Date(), period: string | null = null): boolean {
  const dayRequired = getCheckDays(item).includes(date.getDay())
  if (!period) return dayRequired
  return dayRequired && getRequiredPeriods(item).includes(period)
}

export function formatCheckDays(days: number[] | null | undefined): string {
  const values = Array.isArray(days) && days.length > 0 ? days : [...DEFAULT_CHECK_DAYS]
  if (values.length === 7) return 'Every day'
  return CHECK_DAYS.filter(day => values.includes(day.value)).map(day => day.short).join(', ')
}

export function formatRequiredPeriods(periods: string[] | null | undefined): string {
  const values = Array.isArray(periods) && periods.length > 0 ? periods : [...DEFAULT_CHECK_PERIODS]
  if (values.includes('am') && values.includes('pm')) return 'AM/PM'
  return CHECK_PERIODS.filter(period => values.includes(period.value)).map(period => period.label).join('/')
}
