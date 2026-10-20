/**
 * Which opening / closing checks apply on a given day.
 *
 * check_days is 0=Sun..6=Sat, the same as fridges.check_days (and
 * get_dashboard_snapshot, migration 158). Empty or missing = every day, so a
 * check nobody has scheduled behaves exactly as it always did.
 */
import { getCheckDays } from './temperatureChecks'

type DayScoped = { check_days?: number[] | null }

export function isCheckDueOn(check: DayScoped, date: Date): boolean {
  return getCheckDays(check).includes(date.getDay())
}

/** Checks due on `date`, in their original order. */
export function checksDueOn<T extends DayScoped>(checks: T[], date: Date): T[] {
  return checks.filter(c => isCheckDueOn(c, date))
}

/** Parse a yyyy-MM-dd string as a local calendar date (not UTC midnight). */
export function dateFromISO(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}
