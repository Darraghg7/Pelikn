import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const LAST_VENUE_KEY = 'safeserv_last_venue'

/** True when running as an installed PWA (added to home screen). */
function isPWA() {
  return (
    window.navigator.standalone === true ||   // iOS Safari
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, venueSlug, authLoading, signInWithEmail } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  // PWA saved-state: if opened from home screen and a venue slug is stored,
  // jump straight to that venue's PIN login screen instead of showing this page.
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

  // If already authenticated + venue resolved → redirect into the app
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

    const { error: err, slug } = await signInWithEmail(email.trim(), password)

    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Incorrect email or password'
        : err.message)
      setLoading(false)
      return
    }

    // Store the venue slug so the PWA knows where to go on next launch
    try { localStorage.setItem(LAST_VENUE_KEY, slug) } catch {}

    // Hard redirect — Supabase session is now in localStorage, so the app
    // boots fresh and reads it cleanly. Eliminates all React state race conditions.
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
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-5 py-10 font-sans">

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

      {/* Login card */}
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-charcoal/8 p-7 flex flex-col gap-6">
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
                  className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/25 outline-none focus:border-brand dark:focus:border-charcoal/40 transition-colors"
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
                  className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/25 outline-none focus:border-brand dark:focus:border-charcoal/40 transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs -mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold tracking-wide hover:bg-brand/90 dark:bg-charcoal dark:hover:bg-charcoal/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-charcoal/25 mt-6 tracking-wide">
          Powered by SafeServ · Food safety made simple
        </p>
      </div>
    </div>
  )
}
