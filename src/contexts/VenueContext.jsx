/**
 * VenueContext — resolves venue from URL slug and provides venueId to the app.
 * Caches venue data in localStorage so the app works offline after first load.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FullPageLoader } from '../components/ui/LoadingSpinner'
import { venueLookupFailure } from '../lib/loginScreenState'
import Button from '../components/ui/Button'

const VenueContext = createContext(null)

const venueKey = (slug) => `pelikn_venue_${slug}`

export function VenueProvider({ children }) {
  const { venueSlug } = useParams()
  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  // null, 'not-found' (no venue has this slug) or 'error' (couldn't ask)
  const [failure, setFailure] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!venueSlug) { setLoading(false); setFailure('not-found'); return }
    setFailure(null)

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
        if (prev) setFailure('error')
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
          setFailure(null) // clears the error state if the 8s failsafe fired first
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
              setFailure(null) // clears the error state if the 8s failsafe fired first
            } else if (!hasCache) {
              setFailure(venueLookupFailure(err2))
            }
            setLoading(false)
          })
      })
      .catch(() => {
        if (cancelled) return
        clearTimeout(timeoutId)
        setLoading(false)
        if (!hasCache) setFailure('error')
      })

    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [venueSlug, attempt])

  // Re-read the venue row after something changes it (a plan change in Plan &
  // Billing), without remounting the app.
  const refreshVenue = useCallback(async () => {
    if (!venueSlug) return
    const slug = venueSlug.toLowerCase()
    const { data, error: err } = await supabase
      .from('venues')
      .select('id, name, slug, plan')
      .eq('slug', slug)
      .single()
    if (err || !data) return
    try { localStorage.setItem(venueKey(slug), JSON.stringify(data)) } catch { /* storage full/blocked */ }
    setVenue(data)
  }, [venueSlug])

  const value = useMemo(() => !venue ? null : {
    venueId: venue.id, venueSlug: venue.slug, venueName: venue.name, venuePlan: venue.plan ?? 'starter', refreshVenue,
  }, [venue, refreshVenue])

  if (loading) return <FullPageLoader />

  if (failure || !venue) {
    return (
      <VenueLookupProblem
        slug={venueSlug}
        kind={failure === 'not-found' ? 'not-found' : 'error'}
        onRetry={() => { setLoading(true); setAttempt(a => a + 1) }}
      />
    )
  }

  return (
    <VenueContext.Provider value={value}>
      {children}
    </VenueContext.Provider>
  )
}

// Shown in place of the whole venue app when the slug can't be resolved. The
// two cases need different advice: a mistyped link should go elsewhere, but a
// dropped connection should be retried, not told the venue doesn't exist.
function VenueLookupProblem({ slug, kind, onRetry }) {
  const notFound = kind === 'not-found'
  return (
    <div className="min-h-dvh bg-surface dark:bg-bgDark flex flex-col items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-paperDark rounded-2xl border border-charcoal/8 dark:border-white/8 shadow-sm p-6 text-center">
        <p className="text-[11px] tracking-widest font-semibold uppercase text-charcoal/50 dark:text-white/45 mb-2">
          {notFound ? 'Venue not found' : 'Can’t connect'}
        </p>
        <h1 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
          {notFound ? 'We can’t find that venue' : 'We couldn’t load this venue'}
        </h1>
        <p className="text-sm text-charcoal/60 dark:text-white/55 leading-relaxed mb-5">
          {notFound ? (
            <>No venue uses the link <span className="font-mono text-charcoal/80 dark:text-white/75 break-all">/v/{slug}</span>. Check the link with your manager, or sign in to find your venue.</>
          ) : (
            'Check your internet connection and try again.'
          )}
        </p>
        {notFound ? (
          <a
            href="/login"
            className="block w-full bg-brand text-cream py-3 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
          >
            Manager sign in
          </a>
        ) : (
          <Button
            fullWidth
            onClick={onRetry}
          >
            Try again
          </Button>
        )}
      </div>
      <a href="/" className="mt-6 text-xs text-charcoal/50 dark:text-white/45 hover:text-charcoal/70 dark:hover:text-white/65 transition-colors">
        Go to Pelikn home
      </a>
    </div>
  )
}

export function useVenue() {
  const ctx = useContext(VenueContext)
  if (!ctx) return { venueId: null, venueSlug: null, venueName: null, venuePlan: 'starter', refreshVenue: async () => {} }
  return ctx
}
