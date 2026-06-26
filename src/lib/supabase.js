import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://djwgyyerxvxovicixxrp.supabase.co'
// Anon key is public by design. Hardcoded directly to bypass a Vercel env var
// that was accidentally set to the wrong publishable key format.
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2d5eWVyeHZ4b3ZpY2l4eHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDIyMzEsImV4cCI6MjA4ODkxODIzMX0.PD3MydxFkVladSc7Trje7R3kPikE3axfqnIEkEM08Q8'

export const isConfigured = !!(supabaseUrl && supabaseAnonKey)

// ── Session JWT ───────────────────────────────────────────────────────────────
// Set after PIN login. Injected into every PostgREST request so venue-scoped
// RLS policies can read (auth.jwt() ->> 'venue_id'). Auth endpoints are excluded
// so signup/signOut continue to use the anon key.
let _sessionJwt = null

export const setSessionJwt   = (jwt)  => { _sessionJwt = jwt }
export const clearSessionJwt = ()     => { _sessionJwt = null }

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
  return async function retryFetch(url, options = {}) {
    const method = (options.method ?? 'GET').toUpperCase()
    const isWrite = !['GET', 'HEAD'].includes(method)
    const attempts = isWrite ? maxWriteRetries + 1 : 1

    // Inject the venue-scoped JWT for PostgREST calls only.
    // Auth endpoints (/auth/v1/) keep the anon key so signup/signOut work normally.
    if (_sessionJwt && !url.includes('/auth/v1/')) {
      options = {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${_sessionJwt}` },
      }
    }

    let lastErr
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        // Exponential back-off: 1 s, 2 s
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(url, { ...options, signal: controller.signal })
        clearTimeout(timer)
        return response
      } catch (err) {
        clearTimeout(timer)
        lastErr = err
        // Only retry on network / abort errors (not 4xx/5xx — those aren't thrown)
        const retryable = err?.name === 'AbortError' || err?.name === 'TypeError'
        if (!retryable || attempt === attempts - 1) throw err
        console.warn(`[Pelikn] Write attempt ${attempt + 1} failed (${err.message}), retrying…`)
      }
    }
    throw lastErr
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
