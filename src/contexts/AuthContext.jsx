/**
 * AuthContext — Supabase Auth session for venue owners.
 *
 * This provides device-level authentication. Once an owner logs in with
 * email + password, the device stays locked to their venue until they
 * explicitly sign out. Staff then authenticate within that venue via PIN.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [venueSlug, setVenueSlug]   = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── Resolve which venue this user owns ────────────────────────────────
  const resolveVenue = async (email) => {
    if (!email) return null

    // Look up venue via app_settings manager_email
    const { data } = await supabase
      .from('app_settings')
      .select('venue_id')
      .eq('key', 'manager_email')
      .eq('value', email)
      .limit(1)
      .maybeSingle()

    if (!data?.venue_id) return null

    // Get the venue slug
    const { data: venue } = await supabase
      .from('venues')
      .select('slug')
      .eq('id', data.venue_id)
      .single()

    return venue?.slug ?? null
  }

  // ── Listen for auth state changes ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    // Check existing session on mount — with 8s timeout so a slow/offline
    // Supabase never leaves the app hanging on a white loading screen.
    const sessionCheck = Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getSession timeout')), 8000)
      ),
    ])

    sessionCheck
      .then(async ({ data: { session } }) => {
        if (cancelled) return
        if (session?.user) {
          setUser(session.user)
          try {
            const slug = await resolveVenue(session.user.email)
            if (!cancelled) setVenueSlug(slug)
          } catch (err) {
            console.warn('[AuthContext] resolveVenue failed:', err)
          }
        }
        if (!cancelled) setAuthLoading(false)
      })
      .catch(() => {
        // getSession timed out or failed — clear loading so the app shows the
        // login form instead of an infinite spinner
        if (!cancelled) setAuthLoading(false)
      })

    // Subscribe to future changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user)
            // Only re-resolve venue on actual sign-in, not every token refresh
            if (event === 'SIGNED_IN') {
              const slug = await resolveVenue(session.user.email)
              setVenueSlug(slug)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setVenueSlug(null)
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // ── Sign in with email + password ─────────────────────────────────────
  const signInWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    // Resolve venue for this user
    const slug = await resolveVenue(email)
    if (!slug) {
      // No venue found — sign out and return error
      await supabase.auth.signOut()
      return { error: new Error('No venue found for this account') }
    }

    // flushSync forces React to commit state before this function returns,
    // so RequireVenueAuth sees user immediately when navigate() is called
    flushSync(() => {
      setUser(data.user)
      setVenueSlug(slug)
    })
    return { error: null, slug }
  }, [])

  // ── Sign out of venue (clears Supabase Auth) ─────────────────────────
  const signOutVenue = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setVenueSlug(null)
  }, [])

  const value = useMemo(() => ({
    user, venueSlug, authLoading, signInWithEmail, signOutVenue
  }), [user, venueSlug, authLoading, signInWithEmail, signOutVenue])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
