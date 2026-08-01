/**
 * cacheBus — a one-line notification that a write landed on a given table.
 *
 * The module-level SWR caches (today summary, checks status, team status) are
 * fast but they have no way of knowing when the data underneath them changed.
 * The fix used to be "remember to call invalidateXCache() after the write",
 * which is exactly the kind of thing that gets forgotten the moment someone
 * adds a new write path — and did: invalidateSummaryCache() shipped with no
 * call sites at all, so completing a check never refreshed the Today tiles.
 *
 * Instead, the fetch wrapper in supabase.js announces every successful write
 * here, and caches subscribe to the tables they care about. A new write path
 * gets cache invalidation for free because it goes through the same client.
 *
 * Deliberately dependency-free: supabase.js imports this, so anything this
 * module imported would end up in a cycle with the client.
 */

const listeners = new Set()

/**
 * Subscribe to write notifications. `fn` receives the PostgREST table name.
 * Returns an unsubscribe function.
 */
export function onDataWrite(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Announce a successful write to `table`. Never throws — a broken listener must not fail the request. */
export function emitDataWrite(table) {
  if (!table) return
  for (const fn of listeners) {
    try { fn(table) } catch { /* a listener must never break the write path */ }
  }
}
