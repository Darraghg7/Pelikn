/**
 * persistedCache — localStorage persistence for the module-level SWR caches
 * behind the hub/tile screens (today summary, checks status, team status).
 *
 * The in-memory caches make navigation fast within a session but die on a
 * cold app open, so the first screen of every session showed loading tiles.
 * These helpers keep the last-known result on disk; hooks seed from it and
 * revalidate in the background.
 *
 * One entry per cache name. Each entry records the cache key it was written
 * for (venueId + date), so a new day or a venue switch never shows another
 * scope's stale data — a mismatch just reads as a miss.
 */

const storageKey = (name) => `pelikn_c_${name}`

export function readPersisted(name, key) {
  try {
    const raw = localStorage.getItem(storageKey(name))
    if (!raw) return null
    const entry = JSON.parse(raw)
    return entry?.k === key ? entry.data : null
  } catch {
    return null
  }
}

export function writePersisted(name, key, data) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify({ k: key, data }))
  } catch { /* storage full or unavailable — cache is best-effort */ }
}

export function clearPersisted(name) {
  try {
    localStorage.removeItem(storageKey(name))
  } catch { /* ignore */ }
}
