import { updateRowById } from './writes'

/**
 * Change an opening/closing check: its wording, when it applies (check_days,
 * 0=Sun..6=Sat, null = every day), its department, its place in the list, or
 * retire it (is_active false). Throws if no row changed.
 */
export function updateOpeningCheck(
  id: string,
  venueId: string,
  values: Partial<{
    title: string
    check_days: number[] | null
    department_id: string | null
    sort_order: number
    is_active: boolean
  }>,
): Promise<void> {
  return updateRowById('opening_closing_checks', id, values, venueId, 'That check could not be updated.')
}
