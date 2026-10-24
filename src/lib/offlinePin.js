/**
 * Shared scheme for offline PIN validation.
 *
 * SessionContext caches a PIN record under pinHashKey(staffId) after every
 * successful online PIN login. Anything that needs to validate a PIN
 * without a network round-trip (offline sign-in, manager approval of a late
 * clock-in while offline) checks against that same record — this module is
 * the single source of truth so the write and read sides can never drift.
 *
 * The record is a salted PBKDF2 hash. The old scheme (v1, one unsalted
 * SHA-256) could be reversed for every 4-digit PIN in milliseconds by anyone
 * who could read the device's storage. A 4-digit PIN can never be made
 * uncrackable once its hash is on the device, so offline entry is also
 * limited: after MAX_OFFLINE_TRIES wrong PINs the record is refused until
 * the next online sign-in rewrites it. v1 records are treated as absent.
 */

const VERSION = 'v2'
const ITERATIONS = 100_000
const MAX_OFFLINE_TRIES = 5

export const pinHashKey = (staffId) => `pelikn_pin_${staffId}`
const triesKey = (staffId) => `pelikn_pin_tries_${staffId}`

const toHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map(h => parseInt(h, 16)))

async function derive(staffId, pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${staffId}:${pin}`), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256)
  return toHex(new Uint8Array(bits))
}

/** Build the record to cache after an online sign-in. Returns null if crypto.subtle is unavailable. */
export async function createPinRecord(staffId, pin) {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    return `${VERSION}:${toHex(salt)}:${await derive(staffId, pin, salt)}`
  } catch {
    return null
  }
}

/** Cache a fresh record and clear the offline try counter (call after an online sign-in). */
export async function cachePinRecord(staffId, pin) {
  const record = await createPinRecord(staffId, pin)
  if (!record) return
  localStorage.setItem(pinHashKey(staffId), record)
  localStorage.removeItem(triesKey(staffId))
}

/**
 * Check a PIN against this device's cached record.
 * @returns {Promise<'ok' | 'wrong' | 'locked' | 'none'>}
 *   'none'   — no usable record (never signed in here online, or an old v1 record)
 *   'locked' — too many wrong offline tries; an online sign-in is needed
 */
export async function checkPinRecord(staffId, pin) {
  const record = localStorage.getItem(pinHashKey(staffId))
  const [version, saltHex, hash] = (record ?? '').split(':')
  if (version !== VERSION || !saltHex || !hash) return 'none'

  const tries = Number(localStorage.getItem(triesKey(staffId)) ?? 0)
  if (tries >= MAX_OFFLINE_TRIES) return 'locked'

  let entered
  try {
    entered = await derive(staffId, pin, fromHex(saltHex))
  } catch {
    return 'none'
  }
  if (entered === hash) {
    localStorage.removeItem(triesKey(staffId))
    return 'ok'
  }
  localStorage.setItem(triesKey(staffId), String(tries + 1))
  return 'wrong'
}
