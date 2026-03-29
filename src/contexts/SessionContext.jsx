/**
 * SessionContext — single auth source for all users (staff + managers).
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
import { supabase } from '../lib/supabase'
import {
  SESSION_TOKEN_KEY,
  SESSION_ID_KEY,
  SESSION_NAME_KEY,
  SESSION_ROLE_KEY,
  SESSION_JOB_ROLE_KEY,
  SESSION_SHOW_TEMP_LOGS,
  SESSION_SHOW_ALLERGENS,
  SESSION_VENUE_ID_KEY,
  SESSION_VENUE_SLUG_KEY,
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
  SESSION_ID_KEY,
  SESSION_NAME_KEY,
  SESSION_ROLE_KEY,
  SESSION_JOB_ROLE_KEY,
  SESSION_SHOW_TEMP_LOGS,
  SESSION_SHOW_ALLERGENS,
  SESSION_VENUE_ID_KEY,
  SESSION_VENUE_SLUG_KEY,
]

const clearStorage = () => LS_KEYS.forEach(k => localStorage.removeItem(k))

/** Build a session object from localStorage keys. */
function sessionFromStorage(token) {
  const id = localStorage.getItem(SESSION_ID_KEY)
  if (!token || !id) return null
  return {
    token,
    staffId:       id,
    staffName:     localStorage.getItem(SESSION_NAME_KEY)     ?? '',
    staffRole:     localStorage.getItem(SESSION_ROLE_KEY)     ?? 'staff',
    jobRole:       localStorage.getItem(SESSION_JOB_ROLE_KEY) ?? 'kitchen',
    showTempLogs:  localStorage.getItem(SESSION_SHOW_TEMP_LOGS) === 'true',
    showAllergens: localStorage.getItem(SESSION_SHOW_ALLERGENS) === 'true',
    venueId:       localStorage.getItem(SESSION_VENUE_ID_KEY) ?? '',
    venueSlug:     localStorage.getItem(SESSION_VENUE_SLUG_KEY) ?? '',
  }
}

/** SHA-256 hash of staffId + pin — used for offline PIN validation. */
async function hashPin(staffId, pin) {
  try {
    const data = new TextEncoder().encode(`${staffId}:${pin}:safeserv_offline_v1`)
    const buf  = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

const pinHashKey  = (id) => `safeserv_pin_${id}`
const sessDataKey = (id) => `safeserv_sess_${id}`

export function SessionProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(true)

  // ── Restore session from localStorage on mount ──────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    const id    = localStorage.getItem(SESSION_ID_KEY)

    if (!token || !id) {
      setLoading(false)
      return
    }

    withTimeout(
      supabase.rpc('validate_staff_session', { p_token: token }),
      8000
    )
      .then(({ data: venueId, error }) => {
        if (!error && venueId) {
          setSession(sessionFromStorage(token))
        } else {
          // Server says token is invalid — clear it
          clearStorage()
        }
        setLoading(false)
      })
      .catch(() => {
        // Network offline or timeout — restore from localStorage rather than
        // clearing, so staff aren't logged out just because WiFi is down.
        const restored = sessionFromStorage(token)
        if (restored) setSession(restored)
        else clearStorage()
        setLoading(false)
      })
  }, [])

  // ── Sign in ──────────────────────────────────────────────────────────────
  const signIn = useCallback(async (staffId, pin, venueId, venueSlug) => {
    // ── Offline path ──────────────────────────────────────────────────────
    if (!navigator.onLine) {
      const storedHash = localStorage.getItem(pinHashKey(staffId))
      if (!storedHash) {
        return { error: new Error('No offline data — please log in while online first') }
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
          // Refresh active localStorage keys so sessionFromStorage works correctly
          localStorage.setItem(SESSION_TOKEN_KEY,      sess.token ?? '')
          localStorage.setItem(SESSION_ID_KEY,         sess.staffId)
          localStorage.setItem(SESSION_NAME_KEY,       sess.staffName)
          localStorage.setItem(SESSION_ROLE_KEY,       sess.staffRole)
          localStorage.setItem(SESSION_JOB_ROLE_KEY,   sess.jobRole)
          localStorage.setItem(SESSION_SHOW_TEMP_LOGS, String(sess.showTempLogs))
          localStorage.setItem(SESSION_SHOW_ALLERGENS, String(sess.showAllergens))
          localStorage.setItem(SESSION_VENUE_ID_KEY,   sess.venueId)
          localStorage.setItem(SESSION_VENUE_SLUG_KEY, sess.venueSlug ?? venueSlug ?? '')
          setSession(sess)
          return { error: null }
        }
      } catch { /* corrupt cache */ }
      return { error: new Error('No offline session data — please log in while online first') }
    }

    // ── Online path ───────────────────────────────────────────────────────
    const { data: token, error: tokenErr } = await supabase.rpc(
      'verify_staff_pin_and_create_session',
      { p_staff_id: staffId, p_pin: pin, p_venue_id: venueId }
    )
    if (tokenErr || !token) {
      return { error: tokenErr || new Error('Incorrect PIN') }
    }

    const { data: row, error: rowErr } = await supabase
      .from('staff')
      .select('name, role, job_role, show_temp_logs, show_allergens')
      .eq('id', staffId)
      .single()

    if (rowErr) return { error: rowErr }

    const newSession = {
      token,
      staffId,
      staffName:     row.name             ?? '',
      staffRole:     row.role             ?? 'staff',
      jobRole:       row.job_role         ?? 'kitchen',
      showTempLogs:  row.show_temp_logs   ?? false,
      showAllergens: row.show_allergens   ?? false,
      venueId,
      venueSlug:     venueSlug ?? '',
    }

    // Persist to localStorage
    localStorage.setItem(SESSION_TOKEN_KEY,      token)
    localStorage.setItem(SESSION_ID_KEY,         staffId)
    localStorage.setItem(SESSION_NAME_KEY,       newSession.staffName)
    localStorage.setItem(SESSION_ROLE_KEY,       newSession.staffRole)
    localStorage.setItem(SESSION_JOB_ROLE_KEY,   newSession.jobRole)
    localStorage.setItem(SESSION_SHOW_TEMP_LOGS, String(newSession.showTempLogs))
    localStorage.setItem(SESSION_SHOW_ALLERGENS, String(newSession.showAllergens))
    localStorage.setItem(SESSION_VENUE_ID_KEY,   venueId)
    localStorage.setItem(SESSION_VENUE_SLUG_KEY, venueSlug ?? '')

    // Cache PIN hash + session data for offline use
    hashPin(staffId, pin).then(hash => {
      if (hash) localStorage.setItem(pinHashKey(staffId), hash)
    })
    localStorage.setItem(sessDataKey(staffId), JSON.stringify(newSession))

    setSession(newSession)
    return { error: null }
  }, [])

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    const token = session?.token ?? localStorage.getItem(SESSION_TOKEN_KEY)
    clearStorage()
    setSession(null)
    if (token) {
      supabase.rpc('invalidate_staff_session', { p_token: token }).catch(() => {})
    }
  }, [session?.token])

  const isManager = session?.staffRole === 'manager' || session?.staffRole === 'owner'

  const value = useMemo(() => ({
    session, loading, isManager, signIn, signOut
  }), [session, loading, isManager, signIn, signOut])

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
