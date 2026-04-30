/**
 * AuthContext — Supabase Auth session for venue owners.
 *
 * Supports multi-venue: one Supabase Auth account can own N venues.
 * `venues` is the full list; `venueSlug` is the currently-active one.
 * Single-venue owners see no behavioural difference.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [venues, setVenues]           = useState([])   // all owned venues
  const [venueSlug, setVenueSlug]     = useState(null) // currently active slug
  const [authLoading, setAuthLoading] = useState(true)

  // ── Resolve all venues this user owns ─────────────────────────────────
  // Strategy 1: get_owner_venues() RPC — all new accounts
  // Strategy 2: manager_email in app_settings — legacy single-venue fallback
  const resolveVenues = async (email, userId) => {
    if (userId) {
      const { data: owned } = await supabase.rpc('get_owner_venues')
      if (owned?.length) return owned
    }

    // Legacy fallback — manager_email in app_settings (returns at most 1 venue)
    if (!email) return []
    const { data: setting } = await supabase
      .from('app_settings')
      .select('venue_id')
      .eq('key', 'manager_email')
      .eq('value', email)
      .limit(1)
      .maybeSingle()

    if (!setting?.venue_id) return []

    const { data: venue } = await supabase
      .from('venues')
      .select('id, name, slug, plan, qr_addon, additional_venues')
      .eq('id', setting.venue_id)
      .single()

    return venue ? [venue] : []
  }

  const resolveVenuesSafe = (email, userId, ms = 5000) =>
    Promise.race([
      resolveVenues(email, userId),
      new Promise(resolve => setTimeout(() => resolve([]), ms)),
    ])

  // ── Pick the best slug from a list ────────────────────────────────────
  // Prefer the one stored in localStorage (last visited), else first in list
  const pickSlug = (venueList) => {
    if (!venueList?.length) return null
    try {
      const last = localStorage.getItem('pelikn_last_venue')
      if (last && venueList.some(v => v.slug === last)) return last
    } catch {}
    return venueList[0].slug
  }

  // ── Refresh venue list (called after adding a venue in Settings) ───────
  const refreshVenues = useCallback(async () => {
    const list = await resolveVenuesSafe(user?.email, user?.id, 8000)
    setVenues(list)
    // Don't change the active slug — user is already in a venue
  }, [user])

  // ── Select a venue (called by venue switcher / picker) ─────────────────
  const selectVenue = useCallback((slug) => {
    setVenueSlug(slug)
    try { localStorage.setItem('pelikn_last_venue', slug) } catch {}
  }, [])

  // ── Listen for auth state changes ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false

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
            const list = await resolveVenuesSafe(session.user.email, session.user.id)
            if (!cancelled) {
              setVenues(list)
              setVenueSlug(pickSlug(list))
            }
          } catch (err) {
            console.warn('[AuthContext] resolveVenues failed:', err)
          }
        }
        if (!cancelled) setAuthLoading(false)
      })
      .catch(() => {
        if (!cancelled) setAuthLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user)
            if (event === 'SIGNED_IN') {
              const list = await resolveVenuesSafe(session.user.email, session.user.id)
              setVenues(list)
              setVenueSlug(pickSlug(list))
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setVenues([])
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
  // Returns { error, slug, venues }
  // - Single venue:  slug is set, caller does window.location.replace
  // - Multi-venue:   slug is null, caller shows venue picker
  const signInWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error, slug: null, venues: [] }

    if (data.user?.email === 'demo@pelikn.app') {
      await supabase.functions.invoke('seed-demo')
    }

    const list = await resolveVenuesSafe(email, data.user.id, 10000)
    if (!list.length) {
      await supabase.auth.signOut()
      return { error: new Error('No venue found for this account. Contact support.'), slug: null, venues: [] }
    }

    if (list.length === 1) {
      const slug = list[0].slug
      selectVenue(slug)
      return { error: null, slug, venues: list }
    }

    // Multi-venue — return list, let caller show picker
    setVenues(list)
    return { error: null, slug: null, venues: list }
  }, [selectVenue])

  // ── Sign out ───────────────────────────────────────────────────────────
  const signOutVenue = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setVenues([])
    setVenueSlug(null)
  }, [])

  const value = useMemo(() => ({
    user, venues, venueSlug, authLoading,
    signInWithEmail, signOutVenue, selectVenue, refreshVenues,
  }), [user, venues, venueSlug, authLoading, signInWithEmail, signOutVenue, selectVenue, refreshVenues])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
