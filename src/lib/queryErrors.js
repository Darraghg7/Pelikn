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

/**
 * After a one-call RPC (get_team_status, get_manager_notifications_data, ...)
 * fails: is it worth running the old per-table queries instead?
 *
 * Yes when the function can't run as written: it isn't there (PGRST202, the
 * migration isn't applied) or it no longer matches the schema (Postgres class 42:
 * undefined function, column or table). The separate queries are a real way
 * round that.
 *
 * No when the database is simply struggling: a timeout, a 5xx, a dropped
 * connection, a statement cancelled for running too long. The fallbacks are
 * many requests (21 for the notification bell) and fire on every device at
 * once, so on 13 Oct 2026 they turned one slow call into a pile-on that kept a
 * Nano instance down. The caller should throw instead and let React Query's
 * own retry (and the apiHealth back-off) pace it.
 * @param {{ code?: string } | null | undefined} error
 */
export function rpcCannotRun(error) {
  const code = error?.code
  return typeof code === 'string' && (code === 'PGRST202' || /^42[0-9A-Z]{3}$/.test(code))
}
