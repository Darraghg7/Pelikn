/**
 * State helpers for the staff PIN login screen (/v/:venueSlug).
 *
 * Kept out of LoginPage so the branching is unit-testable: the screen used to
 * render an empty bordered box whenever the staff list hadn't arrived, with no
 * way to tell "still loading", "couldn't reach the server" and "this venue has
 * no staff" apart.
 */

/**
 * Which state the staff picker should show.
 *
 * A list already on screen (from the device cache) always wins: a failed
 * background refresh shouldn't replace names that still work for PIN sign-in,
 * which is what keeps the screen usable offline.
 *
 * @param {{ loading: boolean, failed: boolean, staff: unknown[] | null | undefined }} input
 * @returns {'ready' | 'loading' | 'error' | 'empty'}
 */
export function staffListState({ loading, failed, staff }) {
  if (Array.isArray(staff) && staff.length > 0) return 'ready'
  if (loading) return 'loading'
  if (failed) return 'error'
  return 'empty'
}

/**
 * Classify a failed venue lookup by slug.
 *
 * PostgREST answers `.single()` with code PGRST116 when no row matched, which
 * is the only case where "venue not found" is true. Anything else (offline,
 * timeout, server error) means we don't know, and saying the venue doesn't
 * exist would send staff away from a perfectly good link.
 *
 * @param {{ code?: string } | null | undefined} error
 * @returns {'not-found' | 'error'}
 */
export function venueLookupFailure(error) {
  return error?.code === 'PGRST116' ? 'not-found' : 'error'
}
