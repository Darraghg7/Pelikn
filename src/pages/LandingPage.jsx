import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const LAST_VENUE_KEY = 'safeserv_last_venue'

/** True when running as an installed PWA (added to home screen). */
function isPWA() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

/** Venue picker shown to owners with multiple venues after login. */
function VenuePicker({ venues, onSelect }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-charcoal text-xl">Select a venue</h2>
        <p className="text-xs text-charcoal/40 mt-1">
          Your account has {venues.length} venues — choose one to continue
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {venues.map(v => (
          <button
            key={v.id}
            onClick={() => onSelect(v.slug)}
            className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-charcoal/12 bg-cream/40 hover:bg-cream hover:border-brand/30 transition-all text-left group"
          >
            <div>
              <p className="text-sm font-semibold text-charcoal group-hover:text-brand transition-colors">
                {v.name}
              </p>
              <p className="text-[11px] text-charcoal/40 mt-0.5">safeserv.app/v/{v.slug}</p>
            </div>
            <span className="text-charcoal/25 group-hover:text-brand transition-colors text-lg leading-none">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, venues, venueSlug, authLoading, signInWithEmail, selectVenue } = useAuth()

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [pendingVenues, setPendingVenues] = useState(null) // non-null = show picker

  // PWA saved-state: jump straight to last venue
  useEffect(() => {
    if (authLoading) return
    if (isPWA()) {
      const savedSlug = localStorage.getItem(LAST_VENUE_KEY)
      if (savedSlug) {
        navigate(`/v/${savedSlug}`, { replace: true })
        return
      }
    }
  }, [authLoading, navigate])

  // Already authenticated + venue resolved → redirect
  useEffect(() => {
    if (!authLoading && user && venueSlug) {
      navigate(`/v/${venueSlug}`, { replace: true })
    }
  }, [authLoading, user, venueSlug, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')

    const { error: err, slug, venues: list } = await signInWithEmail(email.trim(), password)

    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Incorrect email or password'
        : err.message)
      setLoading(false)
      return
    }

    if (slug) {
      // Single venue — redirect immediately
      window.location.replace(`/v/${slug}`)
      return
    }

    // Multi-venue — show picker
    setLoading(false)
    setPendingVenues(list)
  }

  const handlePickVenue = (slug) => {
    selectVenue(slug)
    window.location.replace(`/v/${slug}`)
  }

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="animate-pulse text-charcoal/30 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-5 font-sans"
         style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))', paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>

      {/* Branding */}
      <div className="mb-12 text-center">
        <h1 className="font-serif text-brand text-5xl tracking-tight">SafeServ</h1>
        <p className="text-xs tracking-[0.25em] text-charcoal/40 uppercase mt-3">
          Food Safety, Simplified
        </p>
        <p className="text-[10px] tracking-[0.2em] text-charcoal/25 uppercase mt-1">
          Food Safety &amp; Operations
        </p>
      </div>

      {/* Login / picker card */}
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-charcoal/8 p-7 flex flex-col gap-6">

          {pendingVenues ? (
            <VenuePicker venues={pendingVenues} onSelect={handlePickVenue} />
          ) : (
            <>
              <div>
                <h2 className="font-serif text-charcoal text-xl">Welcome back</h2>
                <p className="text-xs text-charcoal/40 mt-1">Sign in to access your venue</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError('') }}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/25 outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/25 outline-none focus:border-brand transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-xs -mt-1">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold tracking-wide hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-charcoal/25 mt-6 tracking-wide">
          Powered by SafeServ · Food safety made simple
        </p>
      </div>
    </div>
  )
}
