/**
 * VenueContext — resolves venue from URL slug and provides venueId to the app.
 * Caches venue data in localStorage so the app works offline after first load.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FullPageLoader } from '../components/ui/LoadingSpinner'

const VenueContext = createContext(null)

const venueKey = (slug) => `safeserv_venue_${slug}`

export function VenueProvider({ children }) {
  const { venueSlug } = useParams()
  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!venueSlug) { setLoading(false); setError(true); return }

    const slug = venueSlug.toLowerCase()
    let cancelled = false

    // ── Load from cache immediately so offline app renders without delay ──
    let hasCache = false
    try {
      const cached = localStorage.getItem(venueKey(slug))
      if (cached) {
        setVenue(JSON.parse(cached))
        setLoading(false)
        hasCache = true
        // Still fetch in background to refresh cache — don't block render
      }
    } catch { /* corrupt cache — ignore, fetch fresh below */ }

    // ── Fetch from Supabase (refreshes cache when online) ──
    const timeoutId = setTimeout(() => {
      if (cancelled) return
      setLoading(prev => {
        if (prev) setError(true)
        return false
      })
    }, 8000)

    supabase
      .from('venues')
      .select('id, name, slug, plan')
      .eq('slug', slug)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) { clearTimeout(timeoutId); return }
        clearTimeout(timeoutId)
        if (!err && data) {
          localStorage.setItem(venueKey(slug), JSON.stringify(data))
          setVenue(data)
          setLoading(false)
          return
        }
        // Retry without plan column (older DB schemas)
        return supabase
          .from('venues')
          .select('id, name, slug')
          .eq('slug', slug)
          .single()
          .then(({ data: d2, error: err2 }) => {
            if (cancelled) return
            if (!err2 && d2) {
              const v = { ...d2, plan: 'starter' }
              localStorage.setItem(venueKey(slug), JSON.stringify(v))
              setVenue(v)
            } else if (!hasCache) {
              setError(true)
            }
            setLoading(false)
          })
      })
      .catch(() => {
        if (cancelled) return
        clearTimeout(timeoutId)
        setLoading(false)
        if (!hasCache) setError(true)
      })

    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [venueSlug])

  const value = useMemo(() => !venue ? null : {
    venueId: venue.id, venueSlug: venue.slug, venueName: venue.name, venuePlan: venue.plan ?? 'starter'
  }, [venue])

  if (loading) return <FullPageLoader />

  if (error || !venue) {
    return (
      <div className="min-h-dvh bg-surface flex flex-col items-center justify-center px-5 font-sans">
        <h1 className="font-bold text-charcoal text-3xl mb-2">Venue not found</h1>
        <p className="text-charcoal/50 text-sm mb-6">The venue "{venueSlug}" doesn't exist.</p>
        <a href="/" className="text-sm text-accent hover:underline">Go to SafeServ home</a>
      </div>
    )
  }

  return (
    <VenueContext.Provider value={value}>
      {children}
    </VenueContext.Provider>
  )
}

export function useVenue() {
  const ctx = useContext(VenueContext)
  if (!ctx) return { venueId: null, venueSlug: null, venueName: null, venuePlan: 'starter' }
  return ctx
}
