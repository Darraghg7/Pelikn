import { upsertRotaPublished } from '../api/shifts'
import { sendPush } from '../sendPush'

/**
 * Whether a week can be (re)published. Staff only need telling when there is
 * something new for them to see: unpublished edits, or a week that has shifts
 * but was never published. `publishedState` is null while unknown (still
 * loading, or the read failed), which must not raise a false "never published".
 */
export function canPublishWeek({ pendingChanges, publishedState, shiftCount }: {
  pendingChanges: number
  publishedState: boolean | null
  shiftCount: number
}): boolean {
  const neverPublished = publishedState === false && shiftCount > 0
  return pendingChanges > 0 || neverPublished
}

/**
 * What a staff member may see of the rota. A week a manager is still drafting
 * stays hidden until it is published, as the rota screen promises. Weeks that
 * have already started stay visible regardless: staff are working them, and
 * rotas built before publishing was enforced were never marked published.
 * `published` is keyed by week start (yyyy-MM-dd); a week missing from it is
 * treated as unpublished.
 */
export function shiftsVisibleToStaff<T extends { week_start: string }>(
  shifts: T[],
  published: Record<string, boolean>,
  currentWeekStartStr: string,
): T[] {
  return shifts.filter((s) => s.week_start <= currentWeekStartStr || published[s.week_start] === true)
}

/** The word on the Publish button. */
export function publishButtonLabel({ publishing, canPublish, publishedState }: {
  publishing: boolean
  canPublish: boolean
  publishedState: boolean | null
}): string {
  if (publishing) return 'Publishing…'
  if (canPublish) return 'Publish'
  return publishedState ? 'Published' : 'Publish'
}

/** Everyone with at least one shift in the list, once each. */
export function staffToNotify(shifts: { staff_id: string | null }[]): string[] {
  return [...new Set(shifts.map((s) => s.staff_id).filter((id): id is string => !!id))]
}

/**
 * Marks the week published and pushes "Rota Published" to everyone on it.
 * Used by both the phone ("Publish") and desktop ("Send notification").
 */
export async function publishRota({ venueId, weekStartStr, shifts }: {
  venueId: string
  weekStartStr: string
  shifts: { staff_id: string | null }[]
}): Promise<{ error: { message: string } | null }> {
  const { error } = await upsertRotaPublished(venueId, weekStartStr, new Date().toISOString())
  if (error) return { error }
  const staffIds = staffToNotify(shifts)
  if (staffIds.length) {
    sendPush({
      venueId,
      notificationType: 'rota_published',
      title: 'Rota Published',
      body: `Your rota for the week of ${weekStartStr} is now available.`,
      url: '/rota',
      staffIds,
    })
  }
  return { error: null }
}
