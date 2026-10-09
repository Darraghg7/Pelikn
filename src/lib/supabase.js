import { createClient } from '@supabase/supabase-js'
import { emitDataWrite } from './cacheBus'
import { reportError } from './reportError'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://djwgyyerxvxovicixxrp.supabase.co'
// Anon key is public by design. Hardcoded directly to bypass a Vercel env var
// that was accidentally set to the wrong publishable key format.
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2d5eWVyeHZ4b3ZpY2l4eHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDIyMzEsImV4cCI6MjA4ODkxODIzMX0.PD3MydxFkVladSc7Trje7R3kPikE3axfqnIEkEM08Q8'

export const isConfigured = !!(supabaseUrl && supabaseAnonKey)

// ── Venue-scoped session JWT ─────────────────────────────────────────────────
// Set after PIN login (staff) or venue selection (owner). Injected as the
// Authorization bearer on every PostgREST (/rest/v1) request so venue-scoped
// RLS can read (auth.jwt() ->> 'venue_id'). The anon key stays as the apikey.
// Also injected on the venue-scoped private Storage buckets (see
// VENUE_SCOPED_BUCKETS). Auth (/auth/v1), Edge Functions (/functions/v1) and
// every other bucket are never overridden — they keep the anon key /
// Supabase-Auth token.
//
// Safety rules that keep this from repeating the 2026 "EC key mismatch" outage:
//   • Only a well-formed, non-expired JWT is ever injected. An expired or
//     unparseable token is ignored — the request falls back to the anon key,
//     which still works (open policies) and returns empty (scoped policies),
//     prompting a refresh rather than a hard 401.
//   • A refresher (registered by SessionContext) re-issues the JWT proactively
//     when it is close to expiry, and reactively on a 401.
//   • Since 146 the database also refuses a JWT whose staff_sessions row is
//     gone (revoked, signed out, expired, deactivated) with a 401. The
//     refresher then can't re-issue either and throws SessionEndedError; the
//     JWT is dropped, SessionContext is told (back to the PIN screen) and the
//     caller gets the 401 — never a quiet anon retry that reads as "no data".
let _sessionJwt    = null
let _sessionJwtExp = 0      // unix seconds; 0 = unknown/unparseable
let _jwtRefresher  = null   // async () => freshJwt | null; throws SessionEndedError
let _refreshing    = null   // the refresh in flight, shared by concurrent calls
let _onSessionEnded = null  // (token) => void

/**
 * Thrown by the JWT refresher when pin-login says the session behind the JWT
 * no longer exists — as opposed to returning null, which means "couldn't
 * reach it, try later". `token` is the staff_sessions token that died, so the
 * handler can ignore an answer about a session that has since been replaced.
 */
export class SessionEndedError extends Error {
  constructor(token, { status = null, reason = null, venueId = null } = {}) {
    super('Session ended')
    this.name    = 'SessionEndedError'
    this.token   = token ?? null
    // What pin-login said (401/403 and its message) and for which venue —
    // reported with the sign-out, never the token itself.
    this.status  = status
    this.reason  = reason
    this.venueId = venueId
  }
}

function jwtClaims(jwt) {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)) ?? {}
  } catch { return {} }
}

function jwtExpSeconds(jwt) {
  const { exp } = jwtClaims(jwt)
  return typeof exp === 'number' ? exp : 0
}

/**
 * Hand the venue JWT to the realtime socket as well as to PostgREST.
 *
 * The fetch wrapper below only sees /rest/v1 — realtime rides a WebSocket and
 * never passes through it. Without this the socket authenticates as anon, so
 * `current_venue_id()` is NULL, `has_venue_access()` is false, and once
 * venue-scoped RLS (091) is switched on every postgres_changes event is
 * filtered out server-side: live updates would go quiet with no error.
 */
function syncRealtimeAuth(jwt) {
  try {
    // Async in supabase-js v2, and nothing downstream waits on it.
    Promise.resolve(supabase.realtime.setAuth(jwt ?? null)).catch((e) => reportError(e, 'supabase:realtime-setAuth'))
  } catch { /* no realtime in this environment — REST is unaffected */ }
}

export const setSessionJwt = (jwt) => {
  _sessionJwt    = jwt || null
  _sessionJwtExp = jwt ? jwtExpSeconds(jwt) : 0
  syncRealtimeAuth(_sessionJwt)
}
export const clearSessionJwt = () => {
  _sessionJwt = null
  _sessionJwtExp = 0
  syncRealtimeAuth(null)
}

// SessionContext registers a callback that re-issues the venue JWT from the
// active session token. Kept here (not imported) to avoid a circular import.
export const registerJwtRefresher = (fn) => { _jwtRefresher = fn }

// SessionContext registers what to do when the session is over: clear it and
// show the PIN screen. It returns false when the answer is about a session
// this device has already replaced (signed in again, switched venue); the
// JWT in memory then belongs to the new session and is kept.
export const registerSessionEndedHandler = (fn) => { _onSessionEnded = fn }

// One refresh at a time: a screen that fires ten queries at once and gets ten
// 401s asks pin-login once, not ten times.
function refreshJwt() {
  if (!_refreshing) {
    _refreshing = Promise.resolve()
      .then(() => _jwtRefresher())
      .finally(() => { _refreshing = null })
  }
  return _refreshing
}

/**
 * pin-login says the session behind the venue JWT is gone. Returns true when
 * that is this device's current session (JWT dropped, back to the PIN screen)
 * and false for a late answer about a replaced one (nothing dropped).
 *
 * Each sign-out is reported with why: which request saw it, what the database
 * answered and what pin-login said. 146 was rolled back on 8 Oct 2026 because
 * a device was signed out and nobody could tell afterwards why.
 */
function endSession(err, { url, dbCode = null, via }) {
  const sent = jwtClaims(_sessionJwt)
  let current = true
  try {
    if (_onSessionEnded) current = _onSessionEnded(err.token) !== false
  } catch (e) { reportError(e, 'supabase:session-ended-handler') }
  reportError(err, {
    context:      'supabase:session-ended',
    via,                                   // 'expired-jwt' | 'refused-jwt'
    path:         restPath(url),
    dbCode,                                // PK401 = 146 refused the JWT
    pinLoginStatus: err.status,            // 401 gone/expired/inactive, 403 venue mismatch
    pinLoginReason: err.reason,
    jwtVenueId:   sent.venue_id ?? null,
    jwtStaffId:   sent.sub ?? null,
    storedVenueId: err.venueId,
    replacedSession: !current,
  })
  if (current) clearSessionJwt()
  return current
}

/** `/rest/v1/venues` from a request URL — no query string, nothing private. */
function restPath(url) {
  const u = typeof url === 'string' ? url : (url?.url ?? '')
  try { return new URL(u).pathname } catch { return null }
}

/** PostgREST error code from a refused response, without consuming it. */
async function errorCodeOf(response) {
  try { return (await response.clone().json())?.code ?? null } catch { return null }
}

// What a data call gets when its session ended before it was sent: the same
// 401 the database gives a dead JWT (146), so it surfaces as an error.
const sessionEndedResponse = () => new Response(
  JSON.stringify({ code: 'PK401', message: 'Session ended', details: null, hint: 'Sign in again with your PIN.' }),
  { status: 401, headers: { 'Content-Type': 'application/json' } },
)

// A JWT is usable only if it parses and has >60 s of life left (clock-skew pad).
const jwtUsable = () => !!_sessionJwt && _sessionJwtExp * 1000 > Date.now() + 60_000

function urlIsRest(url) {
  const u = typeof url === 'string' ? url : (url?.url ?? '')
  return u.includes('/rest/v1/')
}

// Private buckets whose storage policies check the venue JWT claim
// (has_venue_access / is_venue_hr_manager — 085, 086, 123). Without the venue
// JWT a PIN session reaches Storage as anon, so uploads fail RLS and signed
// URLs come back "Object not found". Other buckets (app-assets, staff-photos)
// have dashboard-made policies and keep the anon / Supabase-Auth token.
const VENUE_SCOPED_BUCKETS = ['venue-documents', 'hr-documents', 'training-files']

function urlIsVenueStorage(url) {
  const u = typeof url === 'string' ? url : (url?.url ?? '')
  const at = u.indexOf('/storage/v1/object/')
  if (at === -1) return false
  // …/object/<bucket>/…, …/object/sign/<bucket>/…, …/object/list/<bucket>, etc.
  const segments = u.slice(at + '/storage/v1/object/'.length).split(/[?#]/)[0].split('/')
  return segments.slice(0, 2).some(s => VENUE_SCOPED_BUCKETS.includes(s))
}

/**
 * PostgREST table a data request targets, e.g.
 * `…/rest/v1/fridge_temperature_logs?on_conflict=…` → `fridge_temperature_logs`.
 *
 * An RPC (`…/rest/v1/rpc/get_dashboard_snapshot`) yields `rpc`, never a table
 * name. That matters: RPCs are POSTs, so a read-only snapshot RPC would
 * otherwise be announced as a write, invalidate the cache that just called it,
 * and refetch forever. `rpc` is not a table, so it is dropped here explicitly
 * rather than relying on no cache ever subscribing to that name.
 */
function restTable(url) {
  const u = typeof url === 'string' ? url : (url?.url ?? '')
  const at = u.indexOf('/rest/v1/')
  if (at === -1) return null
  const name = u.slice(at + '/rest/v1/'.length).split(/[?#/]/)[0]
  return !name || name === 'rpc' ? null : name
}

// RPCs are POSTs whether they read or write, so restTable() never names one.
// Those that change data are announced by name, matched on a leading write
// verb (record_clock_event, complete_cleaning_task, save_staff_permissions…).
// Reads (get_/list_/validate_/…_fields) never match, and the background
// refresh_staff_session / register_apns_token are left out on purpose — they
// fire on timers and would refresh every cached list for nothing.
const WRITE_RPC = /^(accept|acknowledge|add|approve|cancel|complete|create|deactivate|delete|deny|edit|link|log|mark|reactivate|record|regenerate|reorder|replace|reset|restrict|revoke|save|submit|unlink|unrestrict|update|upsert)_/

function writeRpcName(url) {
  const u = typeof url === 'string' ? url : (url?.url ?? '')
  const at = u.indexOf('/rest/v1/rpc/')
  if (at === -1) return null
  const name = u.slice(at + '/rest/v1/rpc/'.length).split(/[?#/]/)[0]
  return WRITE_RPC.test(name) ? name : null
}

function withBearer(options, jwt) {
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${jwt}`)
  return { ...options, headers }
}

if (!isConfigured) {
  console.warn(
    '[Pelikn] Missing Supabase environment variables.\n' +
    'Copy .env.example to .env, fill in your project URL and anon key, then restart the dev server.'
  )
}

/**
 * Fetch wrapper with timeout + automatic retry for transient failures.
 *
 * Writes (POST/PATCH/PUT/DELETE) are retried up to 2 extra times with
 * exponential back-off (1 s, 2 s). Reads (GET/HEAD) are not retried —
 * a stale read is not data loss.
 *
 * Aborts after 20 s per attempt. An AbortError is treated as retryable
 * on writes so that a slow connection gets a second chance.
 */
function makeRetryFetch(timeoutMs = 20_000, maxWriteRetries = 2) {
  const doFetch = async (url, options) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  return async function retryFetch(url, options = {}) {
    const method = (options.method ?? 'GET').toUpperCase()
    const isWrite = !['GET', 'HEAD'].includes(method)
    const isRest = urlIsRest(url)
    const needsVenueJwt = isRest || urlIsVenueStorage(url)

    // Proactively refresh a venue JWT that is missing/expiring before a data call.
    if (needsVenueJwt && _sessionJwt && !jwtUsable() && _jwtRefresher) {
      try {
        const fresh = await refreshJwt()
        if (fresh) setSessionJwt(fresh)
      } catch (err) {
        if (err instanceof SessionEndedError && endSession(err, { url, via: 'expired-jwt' })) {
          return sessionEndedResponse()
        }
        /* couldn't reach pin-login, or the answer was about a session already
           replaced — use whatever JWT is current (or anon) below */
      }
    }

    // Inject the venue-scoped JWT on data requests when it is usable.
    let injected = false
    if (needsVenueJwt && jwtUsable()) {
      options = withBearer(options, _sessionJwt)
      injected = true
    }

    let writeRetries = 0
    let didAuthRetry = false
    while (true) {
      try {
        const response = await doFetch(url, options)

        // Reactive recovery (once): an injected token was rejected (expired in
        // the moment, or its session revoked — 146). Re-issue and retry with
        // the fresh token. If pin-login confirms the session is gone, stop
        // here and hand back the 401.
        if (injected && !didAuthRetry && response.status === 401 && _jwtRefresher) {
          didAuthRetry = true
          const sentJwt = options.headers.get('Authorization')
          try {
            const fresh = await refreshJwt()
            if (fresh) { setSessionJwt(fresh); options = withBearer(options, fresh) }
            else injected = false
          } catch (err) {
            if (!(err instanceof SessionEndedError)) { injected = false; continue }
            const dbCode = await errorCodeOf(response)
            if (endSession(err, { url, dbCode, via: 'refused-jwt' })) return response
            // A late answer about a replaced session: retry with the new
            // session's JWT if there is one.
            if (!jwtUsable() || sentJwt === `Bearer ${_sessionJwt}`) return response
            options = withBearer(options, _sessionJwt)
          }
          continue
        }

        // The database refused a JWT pin-login had just re-issued: the two
        // disagree about whether this session is alive. Nothing the device can
        // fix, so the error goes back to the caller, but it must be visible.
        if (injected && didAuthRetry && response.status === 401) {
          const dbCode = await errorCodeOf(response)
          if (dbCode === 'PK401') {
            const sent = jwtClaims(_sessionJwt)
            reportError(new Error('Venue JWT refused right after re-issue'), {
              context: 'supabase:session-check-disagrees',
              path: restPath(url), jwtVenueId: sent.venue_id ?? null, jwtStaffId: sent.sub ?? null,
            })
          }
        }

        // Announce successful data writes so the SWR caches can drop what they
        // are holding. Only 2xx counts — a rejected write changed nothing.
        if (isWrite && isRest && response.ok) {
          const rpc = writeRpcName(url)
          emitDataWrite(rpc ? `rpc:${rpc}` : restTable(url))
        }

        return response
      } catch (err) {
        // Only retry on network / abort errors (not 4xx/5xx — those aren't thrown)
        const retryable = err?.name === 'AbortError' || err?.name === 'TypeError'
        if (isWrite && retryable && writeRetries < maxWriteRetries) {
          writeRetries += 1
          console.warn(`[Pelikn] Write attempt ${writeRetries} failed (${err.message}), retrying…`)
          await new Promise(r => setTimeout(r, 1000 * writeRetries)) // 1 s, 2 s
          continue
        }
        throw err
      }
    }
  }
}

export const supabase = createClient(
  supabaseUrl     || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: true,
      storageKey: 'pelikn-auth-token',
    },
    global: {
      fetch: makeRetryFetch(20_000, 2),
    },
  }
)
