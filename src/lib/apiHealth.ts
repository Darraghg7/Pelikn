/**
 * Is the database answering? A shared answer for the screens that refresh on a
 * timer.
 *
 * On 13 Oct 2026 the Supabase instance (Nano) fell over under load and every
 * device kept asking: each Today screen re-ran its summary, the team widget ran
 * eight queries every 30 s, cleaning and cooling polled. A struggling database
 * that is asked harder does not recover. Background refreshes now stand down
 * while recent requests are failing and come back one at a time.
 *
 * Only background refreshes check this. Anything the person asked for (opening
 * a screen, pulling to refresh, saving) always goes through.
 *
 * The fetch layer (lib/supabase.js) reports each data request here: a 5xx, a
 * timeout or a dropped connection counts as a failure, anything else as a
 * success. After TRIP_AFTER failures in a row the API counts as struggling for
 * a while, doubling each time it is still down, up to MAX_PAUSE_MS. Any
 * success clears it. A 4xx is the app's own mistake, not the database's, so it
 * does not count.
 */

const TRIP_AFTER = 3
const BASE_PAUSE_MS = 15_000
const MAX_PAUSE_MS = 5 * 60_000

let failures = 0
let pausedUntil = 0

export function recordApiResult(ok: boolean): void {
  if (ok) {
    failures = 0
    pausedUntil = 0
    return
  }
  failures += 1
  if (failures >= TRIP_AFTER) {
    const pause = Math.min(MAX_PAUSE_MS, BASE_PAUSE_MS * 2 ** (failures - TRIP_AFTER))
    pausedUntil = Date.now() + pause
  }
}

/** True while background refreshes should hold off. */
export function apiBackedOff(now: number = Date.now()): boolean {
  return now < pausedUntil
}

/** Test seam. */
export function resetApiHealth(): void {
  failures = 0
  pausedUntil = 0
}

/**
 * `ms` plus up to `spread` of itself, random per call. Stops a room of devices
 * that all woke together from all refreshing together.
 */
export function withJitter(ms: number, spread = 0.25): number {
  return Math.round(ms * (1 + Math.random() * spread))
}
