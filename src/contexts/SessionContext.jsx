/**
 * SessionContext — single auth source for all users (staff + managers).
 *
 * Multi-device support:
 *  - Each device login creates its own row in staff_sessions (unique token).
 *  - Multiple devices can be active simultaneously — sessions are never
 *    invalidated by a login on a different device.
 *  - Sessions last 30 days. refresh_staff_session is called every 12 hours
 *    while the app is open, keeping active devices logged in indefinitely.
 *
 * Offline support:
 *  - Session restore: if validate_staff_session times out, restores from
 *    localStorage instead of clearing (prevents logout when WiFi drops).
 *  - PIN sign-in: caches a SHA-256 hash of each staff PIN after a successful
 *    online login. Offline logins are validated against this hash locally.
 *  - Staff session data: cached per-staffId so the session object can be
 *    reconstructed fully offline.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey, setSessionJwt, clearSessionJwt, registerJwtRefresher } from '../lib/supabase'
import {
  SESSION_TOKEN_KEY,
  SESSION_JWT_KEY,
  SESSION_ID_KEY,
  SESSION_NAME_KEY,
  SESSION_ROLE_KEY,
  SESSION_JOB_ROLE_KEY,
  SESSION_SHOW_TEMP_LOGS,
  SESSION_SHOW_ALLERGENS,
  SESSION_VENUE_ID_KEY,
  SESSION_VENUE_SLUG_KEY,
  SESSION_LINKED_VENUES,
  SESSION_PERMISSIONS_KEY,
} from '../lib/constants'

const SessionContext = createContext(null)

/** Race a promise against a timeout — rejects if not resolved within ms. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ])
}

/** All localStorage keys we manage — centralised for easy clearSession(). */
const LS_KEYS = [
  SESSION_TOKEN_KEY,
  SESSION_JWT_KEY,
  SESSION_ID_KEY,
  SESSION_NAME_KEY,
  SESSION_ROLE_KEY,
  SESSION_JOB_ROLE_KEY,
  SESSION_SHOW_TEMP_LOGS,
  SESSION_SHOW_ALLERGENS,
  SESSION_VENUE_ID_KEY,
  SESSION_VENUE_SLUG_KEY,
  SESSION_LINKED_VENUES,
  SESSION_PERMISSIONS_KEY,
]

const clearStorage = () => LS_KEYS.forEach(k => localStorage.removeItem(k))

/**
 * Re-issue a venue-scoped JWT from the currently-stored staff session token.
 * Registered with the Supabase client as the JWT refresher, so an expiring or
 * rejected venue JWT is renewed automatically without forcing a re-login.
 * Reads token/venue from localStorage each call, so it always reflects the
 * active session (including after a venue switch). Returns null on any failure
 * — the caller then falls back to the anon key.
 */
async function issueVenueJwt() {
  const token   = localStorage.getItem(SESSION_TOKEN_KEY)
  const venueId = localStorage.getItem(SESSION_VENUE_ID_KEY)
  if (!token || !venueId) return null
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/pin-login`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey':        supabaseAnonKey,
      },
      body: JSON.stringify({ action: 'issue_jwt', session_token: token, venue_id: venueId }),
    })
    if (!res.ok) return null
    const { jwt } = await res.json()
    if (jwt) localStorage.setItem(SESSION_JWT_KEY, jwt)
    return jwt ?? null
  } catch {
    return null
  }
}

/** Build a session object from localStorage keys. */
function sessionFromStorage(token, verified = false) {
  const id = localStorage.getItem(SESSION_ID_KEY)
  if (!token || !id) return null
  let permissions = []
  try {
    const raw = localStorage.getItem(SESSION_PERMISSIONS_KEY)
    if (raw) permissions = JSON.parse(raw)
  } catch { /* corrupt cache */ }
  return {
    token,
    staffId:       id,
    staffName:     localStorage.getItem(SESSION_NAME_KEY)     ?? '',
    staffRole:     localStorage.getItem(SESSION_ROLE_KEY)     ?? 'staff',
    jobRole:       localStorage.getItem(SESSION_JOB_ROLE_KEY) ?? null,
    showTempLogs:  localStorage.getItem(SESSION_SHOW_TEMP_LOGS) === 'true',
    showAllergens: localStorage.getItem(SESSION_SHOW_ALLERGENS) === 'true',
    permissions,
    venueId:       localStorage.getItem(SESSION_VENUE_ID_KEY) ?? '',
    venueSlug:     localStorage.getItem(SESSION_VENUE_SLUG_KEY) ?? '',
    verified,
  }
}

/** SHA-256 hash of staffId + pin — used for offline PIN validation. */
async function hashPin(staffId, pin) {
  try {
    const data = new TextEncoder().encode(`${staffId}:${pin}:pelikn_offline_v1`)
    const buf  = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

const pinHashKey  = (id) => `pelikn_pin_${id}`
const sessDataKey = (id) => `pelikn_sess_${id}`

const DEV_PREVIEW = import.meta.env.DEV && import.meta.env.VITE_DEV_PREVIEW === 'true'
const DEV_SESSION = DEV_PREVIEW ? {
  token: 'dev-preview-token',
  staffId: 'dev-staff-id',
  staffName: 'Dev Manager',
  staffRole: 'manager',
  jobRole: 'Manager',
  showTempLogs: true,
  showAllergens: true,
  permissions: [],
  venueId: null,
  venueSlug: import.meta.env.VITE_DEV_VENUE ?? '',
  verified: true,
} : null

export function SessionProvider({ children }) {
  const [session,       setSession]       = useState(DEV_SESSION)
  const [loading,       setLoading]       = useState(!DEV_PREVIEW)
  const [linkedVenues,  setLinkedVenues]  = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_LINKED_VENUES)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  // Let the Supabase client renew an expiring/rejected venue JWT on its own.
  useEffect(() => { registerJwtRefresher(issueVenueJwt) }, [])

  // ── Restore session from localStorage on mount ──────────────────────────
  useEffect(() => {
    if (DEV_PREVIEW) return
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    const id    = localStorage.getItem(SESSION_ID_KEY)

    if (!token || !id) {
      setLoading(false)
      return
    }

    // Re-activate the JWT so PostgREST calls are venue-scoped immediately
    const cachedJwt = localStorage.getItem(SESSION_JWT_KEY)
    if (cachedJwt) setSessionJwt(cachedJwt)

    const restored = sessionFromStorage(token, true)
    if (restored) {
      setSession(restored)
      try {
        const raw = localStorage.getItem(SESSION_LINKED_VENUES)
        if (raw) setLinkedVenues(JSON.parse(raw))
      } catch { /* corrupt cache */ }
      setLoading(false)
    }

    withTimeout(
      supabase.rpc('validate_staff_session', { p_token: token }),
      8000
    )
      .then(({ data: isValid, error }) => {
        if (!error && isValid === true) {
          setSession(sessionFromStorage(token, true))
          // Restore linked venues from cache
          try {
            const raw = localStorage.getItem(SESSION_LINKED_VENUES)
            if (raw) setLinkedVenues(JSON.parse(raw))
          } catch { /* corrupt cache */ }
          // Opportunistically extend the session while we have a confirmed
          // valid token — fire-and-forget, failure is non-critical
          supabase.rpc('refresh_staff_session', { p_token: token }).catch(() => {})
        } else if (error) {
          // API error (e.g. brief Supabase outage, RLS issue) — treat the same
          // as a network timeout: restore from localStorage rather than clearing,
          // so a transient server error doesn't log the user out.
          const errRestored = sessionFromStorage(token, navigator.onLine)
          if (errRestored) {
            setSession(errRestored)
            try {
              const raw = localStorage.getItem(SESSION_LINKED_VENUES)
              if (raw) setLinkedVenues(JSON.parse(raw))
            } catch { /* corrupt cache */ }
          } else {
            clearStorage()
          }
        } else {
          // isValid === false — server explicitly says the token is invalid.
          // Clear it so the user is prompted to re-enter their PIN.
          clearStorage()
          setSession(null)
        }
        if (!restored) setLoading(false)
      })
      .catch(() => {
        // Network offline or timeout — restore from localStorage rather than
        // clearing, so staff aren't logged out just because WiFi is down.
        const offlineRestored = sessionFromStorage(token, navigator.onLine)
        if (offlineRestored) {
          setSession(offlineRestored)
          try {
            const raw = localStorage.getItem(SESSION_LINKED_VENUES)
            if (raw) setLinkedVenues(JSON.parse(raw))
          } catch { /* corrupt cache */ }
        } else clearStorage()
        if (!restored) setLoading(false)
      })
  }, [])

  // ── Periodic session refresh (every 12 h while app is open) ─────────────
  // Keeps 30-day sessions alive on active devices without requiring re-login.
  useEffect(() => {
    if (!session?.token) return

    const TWELVE_HOURS = 12 * 60 * 60 * 1000
    const id = setInterval(() => {
      supabase.rpc('refresh_staff_session', { p_token: session.token }).catch(() => {})
    }, TWELVE_HOURS)

    return () => clearInterval(id)
  }, [session?.token])

  // ── Foreground refresh — extend session when device wakes up ─────────────
  // The 12h interval won't fire while the screen is off overnight. When the
  // device comes back to foreground, refresh immediately so the token never
  // lapses between the sleep period and the next scheduled refresh.
  useEffect(() => {
    if (!session?.token) return
    const token = session.token
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.rpc('refresh_staff_session', { p_token: token }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [session?.token])

  // ── Sign in ──────────────────────────────────────────────────────────────
  const signIn = useCallback(async (staffId, pin, venueId, venueSlug) => {
    // ── Offline path ──────────────────────────────────────────────────────
    if (!navigator.onLine) {
      const storedHash = localStorage.getItem(pinHashKey(staffId))
      if (!storedHash) {
        return { error: new Error('No offline data. Please log in while online first') }
      }
      const enteredHash = await hashPin(staffId, pin)
      if (!enteredHash || enteredHash !== storedHash) {
        return { error: new Error('Incorrect PIN') }
      }
      // Restore cached session
      try {
        const cached = localStorage.getItem(sessDataKey(staffId))
        if (cached) {
          const sess = JSON.parse(cached)
          const restoredSession = { ...sess, verified: false }
          localStorage.setItem(SESSION_TOKEN_KEY,      sess.token ?? '')
          localStorage.setItem(SESSION_ID_KEY,         sess.staffId)
          localStorage.setItem(SESSION_NAME_KEY,       sess.staffName)
          localStorage.setItem(SESSION_ROLE_KEY,       sess.staffRole)
          localStorage.setItem(SESSION_JOB_ROLE_KEY,   sess.jobRole)
          localStorage.setItem(SESSION_SHOW_TEMP_LOGS, String(sess.showTempLogs))
          localStorage.setItem(SESSION_SHOW_ALLERGENS, String(sess.showAllergens))
          localStorage.setItem(SESSION_VENUE_ID_KEY,   sess.venueId)
          localStorage.setItem(SESSION_VENUE_SLUG_KEY, sess.venueSlug ?? venueSlug ?? '')
          setSession(restoredSession)
          return { error: null }
        }
      } catch { /* corrupt cache */ }
      return { error: new Error('No offline session data. Please log in while online first') }
    }

    // ── Online path ───────────────────────────────────────────────────────
    // Try the pin-login edge function first — it returns a venue-scoped JWT
    // alongside the session token, enabling RLS enforcement without a paid plan.
    // If the edge function is unavailable or errors for any reason, fall through
    // to the direct RPC so logins are never blocked by an edge function issue.
    let token, jwt
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/pin-login`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey':        supabaseAnonKey,
        },
        body: JSON.stringify({ action: 'login', staff_id: staffId, pin, venue_id: venueId }),
      })
      if (res.ok) {
        const data = await res.json()
        token = data.session_token
        jwt   = data.jwt
      }
      // Non-OK response (e.g. SUPABASE_JWT_SECRET not yet set) falls through
      // to the RPC below — logins still work, just without a JWT for now.
    } catch {
      // Network error or CORS — falls through to RPC below.
    }

    // Fallback: direct RPC — authoritative source for PIN validation and
    // the error message shown to the user on a wrong PIN.
    if (!token) {
      const { data: rpcToken, error: rpcErr } = await supabase.rpc(
        'verify_staff_pin_and_create_session',
        { p_staff_id: staffId, p_pin: pin, p_venue_id: venueId }
      )
      if (rpcErr || !rpcToken) return { error: rpcErr || new Error('Incorrect PIN') }
      token = rpcToken
      jwt   = null
    }

    const { data: row, error: rowErr } = await supabase
      .from('staff')
      .select('name, role, job_role, show_temp_logs, show_allergens')
      .eq('id', staffId)
      .single()

    if (rowErr) return { error: rowErr }

    // Fetch granular permissions for non-managers
    let permissions = []
    if (row.role === 'staff') {
      const { data: permRows } = await supabase
        .from('staff_permissions')
        .select('permission')
        .eq('staff_id', staffId)
        .eq('venue_id', venueId)
      permissions = (permRows ?? []).map(r => r.permission)
    }

    const newSession = {
      token,
      staffId,
      staffName:     row.name             ?? '',
      staffRole:     row.role             ?? 'staff',
      jobRole:       row.job_role         ?? null,
      showTempLogs:  row.show_temp_logs   ?? false,
      showAllergens: row.show_allergens   ?? false,
      permissions,
      venueId,
      venueSlug:     venueSlug ?? '',
      verified:      true,
    }

    // Persist to localStorage
    localStorage.setItem(SESSION_TOKEN_KEY,      token)
    localStorage.setItem(SESSION_ID_KEY,         staffId)
    localStorage.setItem(SESSION_NAME_KEY,       newSession.staffName)
    localStorage.setItem(SESSION_ROLE_KEY,       newSession.staffRole)
    localStorage.setItem(SESSION_JOB_ROLE_KEY,   newSession.jobRole)
    localStorage.setItem(SESSION_SHOW_TEMP_LOGS, String(newSession.showTempLogs))
    localStorage.setItem(SESSION_SHOW_ALLERGENS, String(newSession.showAllergens))
    localStorage.setItem(SESSION_PERMISSIONS_KEY, JSON.stringify(permissions))
    localStorage.setItem(SESSION_VENUE_ID_KEY,   venueId)
    localStorage.setItem(SESSION_VENUE_SLUG_KEY, venueSlug ?? '')

    // Activate the venue-scoped JWT for all subsequent PostgREST calls
    if (jwt) {
      localStorage.setItem(SESSION_JWT_KEY, jwt)
      setSessionJwt(jwt)
    }

    // Cache PIN hash + session data for offline use
    const hash = await hashPin(staffId, pin)
    if (hash) localStorage.setItem(pinHashKey(staffId), hash)
    localStorage.setItem(sessDataKey(staffId), JSON.stringify(newSession))

    // Load linked venues (for overview dashboard — managers with cross-venue access)
    const { data: links } = await supabase.rpc('get_staff_venue_links', { p_session_token: token })
    const venues = (links ?? []).map(l => ({
      id:   l.venue_id,
      name: l.venue_name,
      slug: l.venue_slug,
      plan: l.venue_plan,
    }))
    localStorage.setItem(SESSION_LINKED_VENUES, JSON.stringify(venues))
    setLinkedVenues(venues)

    setSession(newSession)

    // Register for native iOS push notifications (no-op on web)
    import('../hooks/useNativePush').then(({ registerNativePush }) => {
      registerNativePush(newSession.staffId, newSession.venueId)
    }).catch(() => {})

    return { error: null, linkedVenues: venues }
  }, [])

  // ── Switch venue (multi-venue staff) ─────────────────────────────────────
  const switchVenue = useCallback(async (targetVenueId, targetVenueSlug) => {
    const token = session?.token
    if (!token) return { error: new Error('No active session') }

    const { data: newToken, error } = await supabase.rpc('switch_staff_venue', {
      p_token:    token,
      p_venue_id: targetVenueId,
    })
    if (error || !newToken) return { error: error ?? new Error('Switch failed') }

    // Invalidate the old token now that a new one is active — fire-and-forget
    supabase.rpc('invalidate_staff_session', { p_token: token }).catch(() => {})

    localStorage.setItem(SESSION_TOKEN_KEY,      newToken)
    localStorage.setItem(SESSION_VENUE_ID_KEY,   targetVenueId)
    localStorage.setItem(SESSION_VENUE_SLUG_KEY, targetVenueSlug)

    // Get a new venue-scoped JWT for the target venue
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/pin-login`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey':        supabaseAnonKey,
        },
        body: JSON.stringify({ action: 'issue_jwt', session_token: newToken, venue_id: targetVenueId }),
      })
      if (res.ok) {
        const { jwt } = await res.json()
        if (jwt) {
          localStorage.setItem(SESSION_JWT_KEY, jwt)
          setSessionJwt(jwt)
        }
      }
    } catch { /* non-critical — JWT can be refreshed on next login */ }

    return { error: null }
  }, [session?.token])

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    const token = session?.token ?? localStorage.getItem(SESSION_TOKEN_KEY)
    clearStorage()
    clearSessionJwt()
    setSession(null)
    if (token) {
      supabase.rpc('invalidate_staff_session', { p_token: token }).catch(() => {})
    }
  }, [session])

  const isManager = session?.verified !== false && (session?.staffRole === 'manager' || session?.staffRole === 'owner')
  const hasMultiVenueAccess = linkedVenues.length > 0

  const hasPermission = useCallback((permissionId) => {
    if (isManager) return true
    return (session?.permissions ?? []).includes(permissionId)
  }, [isManager, session?.permissions])

  const value = useMemo(() => ({
    session, loading, isManager, signIn, signOut, switchVenue, linkedVenues, hasMultiVenueAccess, hasPermission,
  }), [session, loading, isManager, signIn, signOut, switchVenue, linkedVenues, hasMultiVenueAccess, hasPermission])

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
