/**
 * SessionContext — single auth source for all users (staff + managers).
 *
 * Everyone authenticates via PIN. The `staffRole` field on the session
 * determines what they can see:  'manager' → manager dashboard,
 * anything else → My Shift staff view.
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  SESSION_TOKEN_KEY,
  SESSION_ID_KEY,
  SESSION_NAME_KEY,
  SESSION_ROLE_KEY,
  SESSION_JOB_ROLE_KEY,
  SESSION_SHOW_TEMP_LOGS,
  SESSION_SHOW_ALLERGENS,
} from '../lib/constants'

const SessionContext = createContext(null)

/** All localStorage keys we manage — centralised for easy clearSession(). */
const LS_KEYS = [
  SESSION_TOKEN_KEY,
  SESSION_ID_KEY,
  SESSION_NAME_KEY,
  SESSION_ROLE_KEY,
  SESSION_JOB_ROLE_KEY,
  SESSION_SHOW_TEMP_LOGS,
  SESSION_SHOW_ALLERGENS,
]

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

    supabase
      .rpc('validate_staff_session', { p_token: token })
      .then(({ data: valid, error }) => {
        if (!error && valid) {
          setSession({
            token,
            staffId:      id,
            staffName:    localStorage.getItem(SESSION_NAME_KEY)     ?? '',
            staffRole:    localStorage.getItem(SESSION_ROLE_KEY)     ?? 'staff',
            jobRole:      localStorage.getItem(SESSION_JOB_ROLE_KEY) ?? 'kitchen',
            showTempLogs: localStorage.getItem(SESSION_SHOW_TEMP_LOGS) === 'true',
            showAllergens: localStorage.getItem(SESSION_SHOW_ALLERGENS) === 'true',
          })
        } else {
          clearStorage()
        }
        setLoading(false)
      })
  }, [])

  // ── Sign in ──────────────────────────────────────────────────────────────
  const signIn = async (staffId, pin) => {
    const { data: token, error: tokenErr } = await supabase.rpc(
      'verify_staff_pin_and_create_session',
      { p_staff_id: staffId, p_pin: pin }
    )
    if (tokenErr || !token) {
      return { error: tokenErr || new Error('Incorrect PIN') }
    }

    // Fetch full staff row so we have all fields including new tab settings
    const { data: row, error: rowErr } = await supabase
      .from('staff')
      .select('name, role, job_role, show_temp_logs, show_allergens')
      .eq('id', staffId)
      .single()

    if (rowErr) return { error: rowErr }

    const newSession = {
      token,
      staffId,
      staffName:    row.name       ?? '',
      staffRole:    row.role       ?? 'staff',
      jobRole:      row.job_role   ?? 'kitchen',
      showTempLogs: row.show_temp_logs  ?? false,
      showAllergens: row.show_allergens ?? false,
    }

    // Persist to localStorage
    localStorage.setItem(SESSION_TOKEN_KEY,      token)
    localStorage.setItem(SESSION_ID_KEY,         staffId)
    localStorage.setItem(SESSION_NAME_KEY,       newSession.staffName)
    localStorage.setItem(SESSION_ROLE_KEY,       newSession.staffRole)
    localStorage.setItem(SESSION_JOB_ROLE_KEY,   newSession.jobRole)
    localStorage.setItem(SESSION_SHOW_TEMP_LOGS, String(newSession.showTempLogs))
    localStorage.setItem(SESSION_SHOW_ALLERGENS, String(newSession.showAllergens))

    setSession(newSession)
    return { error: null }
  }

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = () => {
    // Capture token BEFORE clearing storage, then fire-and-forget DB invalidation
    const token = session?.token ?? localStorage.getItem(SESSION_TOKEN_KEY)
    clearStorage()
    setSession(null)
    if (token) {
      supabase.rpc('invalidate_staff_session', { p_token: token }).catch(() => {})
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const clearStorage = () => LS_KEYS.forEach(k => localStorage.removeItem(k))

  const isManager = session?.staffRole === 'manager' || session?.staffRole === 'owner'

  return (
    <SessionContext.Provider value={{ session, loading, isManager, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)

// ── Back-compat shim ─────────────────────────────────────────────────────────
// Files that still import useStaffSession will work until they're updated.
export const useStaffSession = () => {
  const { session, loading, signIn, signOut } = useSession()
  return {
    staffSession: session
      ? {
          token:       session.token,
          staffId:     session.staffId,
          staffName:   session.staffName,
          staffRole:   session.staffRole,
          jobRole:     session.jobRole,
        }
      : null,
    loading,
    signIn,
    signOut,
  }
}
