/**
 * AuthContext — Supabase Auth session for venue owners.
 *
 * This provides device-level authentication. Once an owner logs in with
 * email + password, the device stays locked to their venue until they
 * explicitly sign out. Staff then authenticate within that venue via PIN.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
    // Check existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        try {
          const slug = await resolveVenue(session.user.email)
          setVenueSlug(slug)
        } catch (err) {
          console.warn('[AuthContext] resolveVenue failed:', err)
        }
      }
      setAuthLoading(false)
    }).catch(() => {
      // If getSession fails (e.g. stale token), just mark as not loading
      setAuthLoading(false)
    })

    // Subscribe to future changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          const slug = await resolveVenue(session.user.email)
          setVenueSlug(slug)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setVenueSlug(null)
        }
      }
    )

    return () => subscription.unsubscribe()
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

    setUser(data.user)
    setVenueSlug(slug)
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
