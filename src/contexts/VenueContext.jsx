/**
 * VenueContext — resolves venue from URL slug and provides venueId to the app.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FullPageLoader } from '../components/ui/LoadingSpinner'

const VenueContext = createContext(null)

export function VenueProvider({ children }) {
  const { venueSlug } = useParams()
  const [venue, setVenue] = useState(null)    // { id, name, slug, plan }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!venueSlug) { setLoading(false); setError(true); return }

    const slug = venueSlug.toLowerCase()

    // Try with plan column first; fall back to base columns if plan doesn't exist yet
    supabase
      .from('venues')
      .select('id, name, slug, plan')
      .eq('slug', slug)
      .single()
      .then(({ data, error: err }) => {
        if (!err && data) {
          setVenue(data)
          setLoading(false)
          return
        }
        // Retry without plan column (migration 022 may not have run yet)
        supabase
          .from('venues')
          .select('id, name, slug')
          .eq('slug', slug)
          .single()
          .then(({ data: d2, error: err2 }) => {
            if (err2 || !d2) setError(true)
            else setVenue({ ...d2, plan: 'starter' })
            setLoading(false)
          })
      })
  }, [venueSlug])

  // useMemo must be called unconditionally (Rules of Hooks) — before any early returns
  const value = useMemo(() => !venue ? null : {
    venueId: venue.id, venueSlug: venue.slug, venueName: venue.name, venuePlan: venue.plan ?? 'starter'
  }, [venue])

  if (loading) return <FullPageLoader />

  if (error || !venue) {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-5 font-sans">
        <h1 className="font-serif text-charcoal text-3xl mb-2">Venue not found</h1>
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
  if (!ctx) {
    // Fallback for components rendered outside VenueProvider (shouldn't happen in normal flow)
    return { venueId: null, venueSlug: null, venueName: null, venuePlan: 'starter' }
  }
  return ctx
}
