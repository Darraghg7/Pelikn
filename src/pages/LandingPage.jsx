import React, { useState, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export const LAST_VENUE_KEY = 'pelikn_last_venue'

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
        <h2 className="font-bold text-charcoal text-xl">Select a venue</h2>
        <p className="text-xs text-charcoal/40 mt-1">
          Your account has {venues.length} venues — choose one to continue
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {venues.map(v => (
          <button
            key={v.id}
            onClick={() => onSelect(v.slug)}
            className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-charcoal/12 bg-white hover:bg-cream hover:border-brand/30 transition-all text-left group"
          >
            <div>
              <p className="text-sm font-semibold text-charcoal group-hover:text-brand transition-colors">
                {v.name}
              </p>
              <p className="text-[11px] text-charcoal/40 mt-0.5">pelikn.app/v/{v.slug}</p>
            </div>
            <span className="text-charcoal/25 group-hover:text-brand transition-colors text-lg leading-none">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Pelikn logo icon — same paths as the splash screen, rendered as solid fill. */
function AppIconSvg({ size = 36, iconColor = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 218.749 224.045" fill="none">
      <path fill={iconColor} d="M111.581 104.182C96.2532 104.543 80.9327 105.088 65.6202 105.829C60.5271 106.056 45.127 107.88 41.575 105.113C40.7355 102.743 40.8666 103.955 41.3785 101.335C43.6299 98.8182 47.2266 98.3284 50.4259 98.659C63.5708 100.006 131.793 91.8746 139.38 94.6178C143.225 99.2529 133.006 106.588 129.368 111.762C114.802 132.477 110.197 170.39 77.5307 168.731C49.3708 165.694 45.8813 136.75 46.7483 115.308C70.6601 112.405 93.878 108.474 117.612 105.315C116.161 104.28 113.504 104.335 111.581 104.182Z"/>
      <path fill={iconColor} d="M148.644 51.1993C183.239 49.7481 187.978 90.0071 164.264 109.344C142.392 127.174 130.764 152.291 163.008 168.658L160.027 168.645C139.961 168.474 133.495 157.422 134.31 138.44C137.83 118.498 152.458 110.25 164.662 95.8485C177.496 80.4735 167.956 55.9997 146.305 60.1389C135.522 62.1963 128.977 74.4423 123.111 82.935C119.461 82.935 115.959 83.1248 112.322 83.3085C122.658 68.6928 129.24 54.0955 148.644 51.1993Z"/>
    </svg>
  )
}

function AppIcon({ size = 36, bgClass = 'bg-white/10 border border-white/15', iconColor = '#fff' }) {
  return (
    <div className={`rounded-3xl ${bgClass} flex items-center justify-center`}
         style={{ width: size * 1.6, height: size * 1.6 }}>
      <AppIconSvg size={size} iconColor={iconColor} />
    </div>
  )
}

function FieldIcon({ type }) {
  if (type === 'mail') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="14" x="3" y="5" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, venueSlug, authLoading, signInWithEmail, selectVenue } = useAuth()

  // Wait for the splash screen to finish before triggering entrance animations
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && window.__peliknSplashDone === true)
  // useLayoutEffect fires before the browser paints — ensures landing-ready
  // class is added in the same frame as the event, with no extra render gap
  useLayoutEffect(() => {
    if (ready) return
    const onDone = () => setReady(true)
    window.addEventListener('pk-splash-done', onDone, { once: true })
    const fallback = setTimeout(() => setReady(true), 5200)
    return () => { window.removeEventListener('pk-splash-done', onDone); clearTimeout(fallback) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [error, setError]               = useState('')
  const [notice, setNotice]             = useState('')
  const [loading, setLoading]           = useState(false)
  const [pendingVenues, setPendingVenues] = useState(null)
  const [view, setView]                 = useState('welcome') // 'welcome' | 'signin' | 'join' | 'picker'

  const [joinCode, setJoinCode]         = useState('')
  const [joinError, setJoinError]       = useState('')
  const [joinLoading, setJoinLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    setNotice('')

    const { error: err, slug, venues: list, needsOnboarding } = await signInWithEmail(email.trim(), password)

    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Incorrect email or password'
        : err.message)
      setLoading(false)
      return
    }

    if (needsOnboarding) {
      navigate('/signup')
      return
    }

    if (slug) {
      window.location.replace(`/v/${slug}/dashboard`)
      return
    }

    // Multi-venue — show picker
    setLoading(false)
    setPendingVenues(list)
    setView('picker')
  }

  const handlePickVenue = (slug) => {
    selectVenue(slug)
    window.location.replace(`/v/${slug}/dashboard`)
  }

  const handleForgotPassword = async () => {
    setError('')
    setNotice('')
    const address = email.trim()
    if (!address) {
      setError('Enter your email first')
      return
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(address)
    if (err) {
      setError(err.message)
      return
    }
    setNotice('Reset link sent')
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinLoading(true)
    setJoinError('')
    const { data, error: err } = await supabase.rpc('get_venue_by_code', { p_code: code })
    setJoinLoading(false)
    if (err || !data?.length) {
      setJoinError('Code not found. Check with your manager')
      return
    }
    navigate(`/v/${data[0].slug}`)
  }

  const openSignIn = () => { setView('signin'); setError(''); setNotice('') }
  const openJoin   = () => { setView('join'); setJoinCode(''); setJoinError('') }
  const closeSheet = () => { setView('welcome'); setError(''); setNotice(''); setJoinError('') }

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-brand flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-brand font-sans flex flex-col">
      {/* ── MOBILE: native-style sign-in screen (hidden on md+) ─────────── */}
      <div className="pelikn-ios-login md:hidden">
        <div className={`pelikn-ios-card${ready ? ' landing-ready' : ''}`}>
          <div className="pelikn-ios-motion" aria-hidden="true" />
          <div className="pelikn-ios-flow pelikn-ios-flow-one" aria-hidden="true" />

          <div className="pelikn-ios-brand">
            <div className="pelikn-ios-mark" aria-hidden="true">
              <AppIconSvg size={57} iconColor="rgba(255,255,255,0.95)" />
            </div>
          </div>

          {view === 'picker' && pendingVenues ? (
            <div className="pelikn-ios-panel">
              <p className="pelikn-ios-panel-title">Select a venue</p>
              <div className="pelikn-ios-venue-list">
                {pendingVenues.map(v => (
                  <button key={v.id} type="button" onClick={() => handlePickVenue(v.slug)}>
                    <span>{v.name}</span>
                    <span>Continue</span>
                  </button>
                ))}
              </div>
            </div>
          ) : view === 'join' ? (
            <form onSubmit={handleJoin} className="pelikn-ios-form">
              <div className="pelikn-ios-field">
                <input
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setJoinError('') }}
                  placeholder="Venue code"
                  className="pelikn-ios-input"
                />
              </div>
              {joinError && <p className="pelikn-ios-error">{joinError}</p>}
              <button type="submit" disabled={joinLoading || joinCode.length < 4} className="pelikn-ios-primary">
                {joinLoading ? 'Looking up...' : 'Continue'}
              </button>
              <button type="button" onClick={openSignIn} className="pelikn-ios-secondary">
                Sign in instead
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="pelikn-ios-form">
              <div className="pelikn-ios-field">
                <FieldIcon type="mail" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); setNotice('') }}
                  placeholder="Email"
                  className="pelikn-ios-input"
                />
              </div>
              <div className="pelikn-ios-field pelikn-ios-password">
                <FieldIcon type="lock" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); setNotice('') }}
                  placeholder="Password"
                  className="pelikn-ios-input"
                />
              </div>
              <button type="button" onClick={handleForgotPassword} className="pelikn-ios-forgot">
                Forgot password?
              </button>
              {error && <p className="pelikn-ios-error">{error}</p>}
              {notice && <p className="pelikn-ios-notice">{notice}</p>}
              <button type="submit" disabled={loading || !email.trim() || !password} className="pelikn-ios-primary">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div className="pelikn-ios-divider"><span>or</span></div>
              <button type="button" onClick={openJoin} className="pelikn-ios-secondary">
                Join with venue code
              </button>
            </form>
          )}

          <p className="pelikn-ios-signup">
            Don't have an account? <button type="button" onClick={() => navigate('/signup')}>Sign up</button>
          </p>
        </div>
      </div>

      {/* ── DESKTOP: centred card (md+) ───────────────────────────── */}
      <div className="hidden md:flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-charcoal/8 p-8 flex flex-col gap-6">

          {/* Logo */}
          <div className="text-center pb-1">
            <AppIcon
              size={24}
              bgClass="bg-brand/10"
              iconColor="rgba(26,60,46,0.9)"
            />
          </div>

          {view === 'welcome' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/signup')}
                className="w-full bg-brand text-cream rounded-xl py-3.5 text-sm font-bold tracking-wide hover:bg-brand/90 transition-colors"
              >
                Get Started
              </button>
              <button
                onClick={openSignIn}
                className="w-full border border-charcoal/15 text-charcoal rounded-xl py-3.5 text-sm font-semibold hover:border-charcoal/30 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={openJoin}
                className="w-full text-charcoal/40 text-sm font-medium py-1.5 hover:text-charcoal/70 transition-colors"
              >
                Join with venue code
              </button>
            </div>
          )}

          {view === 'signin' && (
            <>
              <div>
                <h2 className="font-bold text-charcoal text-xl">Welcome back</h2>
                <p className="text-xs text-charcoal/40 mt-1">Sign in to access your venue</p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Email</label>
                    <input
                      type="email" required autoComplete="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError('') }}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/25 outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Password</label>
                    <input
                      type="password" required autoComplete="current-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder:text-charcoal/25 outline-none focus:border-brand transition-colors"
                    />
                  </div>
                </div>
                {error && <p className="text-danger text-xs -mt-1">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold tracking-wide hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
              <div className="text-center">
                <button
                  type="button"
                  onClick={closeSheet}
                  className="text-xs text-charcoal/35 hover:text-charcoal/60 transition-colors"
                >
                  ← Back
                </button>
              </div>
            </>
          )}

          {view === 'join' && (
            <>
              <div>
                <h2 className="font-bold text-charcoal text-xl">Join a venue</h2>
                <p className="text-xs text-charcoal/40 mt-1">Enter the code your manager shared with you</p>
              </div>
              <form onSubmit={handleJoin} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Venue Code</label>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setJoinError('') }}
                    placeholder="e.g. NOMAD23"
                    className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal font-mono tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-charcoal/25 outline-none focus:border-brand transition-colors uppercase"
                  />
                  {joinError && <p className="text-danger text-xs mt-1.5">{joinError}</p>}
                </div>
                <button
                  type="submit"
                  disabled={joinLoading || joinCode.length < 4}
                  className="w-full bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold tracking-wide hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {joinLoading ? 'Looking up…' : 'Continue →'}
                </button>
              </form>
              <div className="text-center">
                <button type="button" onClick={closeSheet}
                  className="text-xs text-charcoal/35 hover:text-charcoal/60 transition-colors">
                  ← Back
                </button>
              </div>
            </>
          )}

          {view === 'picker' && pendingVenues && (
            <VenuePicker venues={pendingVenues} onSelect={handlePickVenue} />
          )}
        </div>
      </div>

    </div>
  )
}
