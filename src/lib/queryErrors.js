/**
 * Helpers for Supabase reads inside React Query queryFns.
 *
 * A Supabase read never throws — a failure comes back as `{ data: null, error }`.
 * If a queryFn ignores `error`, React Query sees a successful empty result and
 * the screen shows "Nothing here yet" instead of a load error. So every read in
 * a queryFn throws its error, and App.jsx's QueryCache reports it once via
 * reportQueryError — individual hooks don't need to call reportError.
 */
import { reportError } from './reportError'

/**
 * Throws the first `error` among several Supabase results (e.g. the array a
 * Promise.all of reads resolves to). Results without an `error` key are fine.
 * @param {...any} results  Supabase results, or plain values (ignored)
 */
export function throwIfError(...results) {
  for (const r of results) {
    if (r && r.error) throw r.error
  }
}

/**
 * QueryCache onError handler — fires once per failed query, after retries.
 * The context names the query by the readable (string) parts of its key, so
 * Sentry groups "useDuties failed" rather than one issue per venue id.
 * @param {unknown} error
 * @param {{ queryKey: readonly unknown[] }} query
 */
export function reportQueryError(error, query) {
  const label = query.queryKey.filter(k => typeof k === 'string' && !/^[0-9a-f-]{36}$/i.test(k)).slice(0, 3).join('/')
  reportError(error, { context: `query:${label}`, queryKey: query.queryKey })
}
