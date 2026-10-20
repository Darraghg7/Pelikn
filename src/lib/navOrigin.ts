/**
 * Where did the person just come from?
 *
 * Sub-pages (Cleaning, Fridges, Opening & Closing…) show a "‹ Checks" or
 * "‹ Team" back link to their hub. Opened from a dashboard card that sent them
 * to the hub they never visited, so back felt broken. When the previous page
 * in this visit was the dashboard, the back link now says "Home" and returns
 * there. Anything else (a deep link, a reload, the hub itself) keeps the hub
 * link.
 *
 * Tracked in memory, not history state, so it needs no change to any link.
 * `noteLocation` is idempotent for a given path, so every component that reads
 * it during render can call it safely, in any order.
 */
import { useLocation } from 'react-router-dom'

let current: string | null = null
let previous: string | null = null

export function noteLocation(path: string): void {
  if (path === current) return
  previous = current
  current = path
}

export function previousLocation(): string | null {
  return previous
}

const isDashboard = (path: string | null, base: string) => path === `${base}/dashboard`

/** True when the page before this one was the venue dashboard. */
export function useCameFromDashboard(venueSlug: string | null | undefined): boolean {
  const { pathname } = useLocation()
  noteLocation(pathname)
  return !!venueSlug && isDashboard(previous, `/v/${venueSlug}`)
}
