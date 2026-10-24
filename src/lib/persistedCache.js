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

// ── Sign-out ────────────────────────────────────────────────────────────────
// These caches (and the widget caches, pelikn_w_*) are keyed by venue and
// date, not by person, so on a shared tablet the next person to sign in was
// shown the last person's cached screens — including manager-only details.
// Every sign-out path announces itself here; the caches are wiped and
// listeners (the React Query client in App.jsx) clear their own.

const signOutListeners = new Set()

/** Subscribe to sign-outs. Returns an unsubscribe function. */
export function onSignedOut(fn) {
  signOutListeners.add(fn)
  return () => signOutListeners.delete(fn)
}

/** Wipe every cached screen on this device and tell listeners. Never throws. */
export function announceSignedOut() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('pelikn_c_') || k.startsWith('pelikn_w_'))
      .forEach(k => localStorage.removeItem(k))
  } catch { /* storage unavailable — nothing persisted to wipe */ }
  for (const fn of signOutListeners) {
    try { fn() } catch { /* a listener must never break sign-out */ }
  }
}
