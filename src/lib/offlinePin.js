/**
 * Shared scheme for offline PIN validation.
 *
 * SessionContext caches a hash under pinHashKey(staffId) after every
 * successful online PIN login. Anything that needs to validate a PIN
 * without a network round-trip (e.g. manager approval of a late
 * clock-in while offline) reads that same cache — this module is the
 * single source of truth for the hash so the write and read sides can
 * never drift apart.
 */

/** SHA-256 hash of staffId + pin, hex-encoded. Returns null if unavailable (e.g. no crypto.subtle). */
export async function hashPin(staffId, pin) {
  try {
    const data = new TextEncoder().encode(`${staffId}:${pin}:pelikn_offline_v1`)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

export const pinHashKey = (staffId) => `pelikn_pin_${staffId}`
