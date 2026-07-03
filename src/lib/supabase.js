import { createClient } from '@supabase/supabase-js'

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
// Auth (/auth/v1), Edge Functions (/functions/v1) and Storage are never
// overridden — they keep the anon key / Supabase-Auth token.
//
// Safety rules that keep this from repeating the 2026 "EC key mismatch" outage:
//   • Only a well-formed, non-expired JWT is ever injected. An expired or
//     unparseable token is ignored — the request falls back to the anon key,
//     which still works (open policies) and returns empty (scoped policies),
//     prompting a refresh rather than a hard 401.
//   • A refresher (registered by SessionContext) re-issues the JWT proactively
//     when it is close to expiry, and reactively on a 401.
let _sessionJwt    = null
let _sessionJwtExp = 0      // unix seconds; 0 = unknown/unparseable
let _jwtRefresher  = null   // async () => freshJwt | null

function jwtExpSeconds(jwt) {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload))
    return typeof claims.exp === 'number' ? claims.exp : 0
  } catch { return 0 }
}

export const setSessionJwt = (jwt) => {
  _sessionJwt    = jwt || null
  _sessionJwtExp = jwt ? jwtExpSeconds(jwt) : 0
}
export const clearSessionJwt = () => { _sessionJwt = null; _sessionJwtExp = 0 }

// SessionContext registers a callback that re-issues the venue JWT from the
// active session token. Kept here (not imported) to avoid a circular import.
export const registerJwtRefresher = (fn) => { _jwtRefresher = fn }

// A JWT is usable only if it parses and has >60 s of life left (clock-skew pad).
const jwtUsable = () => !!_sessionJwt && _sessionJwtExp * 1000 > Date.now() + 60_000

function urlIsRest(url) {
  const u = typeof url === 'string' ? url : (url?.url ?? '')
  return u.includes('/rest/v1/')
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

    // Proactively refresh a venue JWT that is missing/expiring before a data call.
    if (isRest && _sessionJwt && !jwtUsable() && _jwtRefresher) {
      try {
        const fresh = await _jwtRefresher()
        if (fresh) setSessionJwt(fresh)
      } catch { /* fall back to anon below */ }
    }

    // Inject the venue-scoped JWT on data requests when it is usable.
    let injected = false
    if (isRest && jwtUsable()) {
      options = withBearer(options, _sessionJwt)
      injected = true
    }

    let writeRetries = 0
    let didAuthRetry = false
    while (true) {
      try {
        const response = await doFetch(url, options)

        // Reactive recovery (once): an injected token was rejected (expired in
        // the moment, or revoked). Re-issue and retry with the fresh token.
        if (injected && !didAuthRetry && response.status === 401 && _jwtRefresher) {
          didAuthRetry = true
          try {
            const fresh = await _jwtRefresher()
            if (fresh) { setSessionJwt(fresh); options = withBearer(options, fresh) }
            else injected = false
          } catch { injected = false }
          continue
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
