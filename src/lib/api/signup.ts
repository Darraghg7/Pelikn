import { supabase } from '../supabase'

/**
 * First free venue URL for a name: `base`, then `base-2`, `base-3` …
 * (suggest_venue_slug, migration 155). Resolves to null if the call fails,
 * including the function not being applied yet: callers then keep the plain
 * slug they derived locally.
 */
export async function suggestVenueSlug(base: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('suggest_venue_slug', { p_base: base })
  if (error || typeof data !== 'string' || !data) return null
  return data
}

/** True while the signed-in owner of this venue has not chosen their PIN yet. */
export async function ownerPinPending(venueId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('owner_pin_pending', { p_venue_id: venueId })
  return !error && data === true
}

/** The owner's first PIN. Only works while ownerPinPending() is true. */
export function setOwnerPin(venueId: string, pin: string) {
  return supabase.rpc('set_owner_pin', { p_venue_id: venueId, p_pin: pin })
}
