import { updateRowById } from './writes'

/**
 * Change when an opening/closing check applies (check_days, 0=Sun..6=Sat, null
 * = every day) and which department it belongs to. Throws if no row changed.
 */
export function updateOpeningCheck(
  id: string,
  venueId: string,
  values: { check_days: number[] | null; department_id: string | null },
): Promise<void> {
  return updateRowById('opening_closing_checks', id, values, venueId, 'That check could not be updated.')
}
