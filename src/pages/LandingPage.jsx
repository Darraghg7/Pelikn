import React, { useState, useEffect, useLayoutEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import Logo, { LogoLoader } from '../components/ui/Logo'
import Button from '../components/ui/Button'
import useForceLight from '../hooks/useForceLight'
import { HEADLINE, LABEL, INPUT } from './signup/styles'

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
        <h2 className="font-bold text-charcoal dark:text-white text-xl">Select a venue</h2>
        <p className="text-xs text-charcoal/40 dark:text-white/35 mt-1">
          Your account has {venues.length} venues — choose one to continue
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {venues.map(v => (
          <button
            key={v.id}
            onClick={() => onSelect(v.slug)}
            className="flex items-center justify-between w-full px-4 py-3.5 rounded-control border border-charcoal/12 dark:border-white/15 bg-white dark:bg-paperDark hover:bg-cream hover:border-brand/30 transition-all text-left group"
          >
            <div>
              <p className="text-sm font-semibold text-charcoal dark:text-white group-hover:text-brand transition-colors">
                {v.name}
              </p>
              <p className="text-caption text-charcoal/40 dark:text-white/35 mt-0.5">get-pelikn.com/v/{v.slug}</p>
            </div>
            <span className="text-charcoal/25 dark:text-white/25 group-hover:text-brand transition-colors text-lg leading-none">→</span>
          </button>
        ))}
      </div>
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

/** The installed iOS/Android apps open on this screen, so it keeps the dark
 *  glass look that matches the native launch screen. On the web it matches
 *  the marketing and signup pages instead. */
function isNativeApp() {
  return Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    window.Capacitor?.isNativePlatform?.() === true
}

function WebLogin({
  view, setView, email, setEmail, password, setPassword, error, setError, notice, setNotice,
  loading, onSubmit, onForgot, pendingVenues, onPickVenue,
  joinCode, setJoinCode, joinError, setJoinError, joinLoading, onJoin, onOpenSignIn, onOpenJoin, onSignUp,
}) {
  useForceLight()
  const title = view === 'picker' ? 'Select a venue.' : view === 'join' ? 'Join your venue.' : 'Sign in.'
  return (
    <div className="min-h-dvh bg-cream font-sans text-charcoal">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
        <a href="/" aria-label="Pelikn home" className="hover:opacity-80 transition-opacity"><Logo variant="full" size="md" /></a>
        <Button variant="secondary" pill size="sm" onClick={onSignUp}>Sign up</Button>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-10 pb-20 sm:pt-16">
        <h1 className="text-charcoal mb-12" style={HEADLINE}>{title}</h1>

        {view === 'picker' && pendingVenues ? (
          <div className="flex flex-col gap-3 max-w-xl">
            <p className="text-title-sm text-charcoal/75 mb-3">Your account has {pendingVenues.length} venues. Choose one to continue.</p>
            {pendingVenues.map(v => (
              <Button key={v.id} variant="secondary" size="lg" className="!h-auto !justify-between !px-6 !py-5 !rounded-sheet text-left" onClick={() => onPickVenue(v.slug)}>
                <span className="text-title font-medium tracking-[-0.025em]">{v.name}</span>
                <span className="text-body text-charcoal/70 font-normal">get-pelikn.com/v/{v.slug}</span>
              </Button>
            ))}
          </div>
        ) : view === 'join' ? (
          <form onSubmit={onJoin} className="flex flex-col gap-6 max-w-xl">
            <div>
              <label htmlFor="join-code" className={LABEL}>Venue code</label>
              <input
                id="join-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={6}
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setJoinError('') }}
                placeholder="Venue code"
                className={`${INPUT} font-mono tracking-[0.2em] placeholder:tracking-normal placeholder:font-sans`}
              />
            </div>
            {joinError && <div role="alert" className="bg-badBg border border-bad/25 rounded-control px-5 py-4"><p className="text-bad text-body-lg">{joinError}</p></div>}
            <div className="flex flex-wrap gap-3">
              <Button pill size="lg" type="submit" loading={joinLoading} disabled={joinCode.length < 4} className="px-8">{joinLoading ? 'Looking up…' : 'Continue'}</Button>
              <Button pill size="lg" variant="secondary" onClick={onOpenSignIn} className="px-8">Sign in instead</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-xl">
            <div className="flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                aria-label="Email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); setNotice('') }}
                placeholder="Email"
                className={INPUT}
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                aria-label="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); setNotice('') }}
                placeholder="Password"
                className={INPUT}
              />
              <div className="px-1">
                <Button variant="link" size="sm" onClick={onForgot}>Forgot password?</Button>
              </div>
            </div>
            {error && <div role="alert" className="bg-badBg border border-bad/25 rounded-control px-5 py-4"><p className="text-bad text-body-lg">{error}</p></div>}
            {notice && <div role="status" className="bg-goodBg border border-good/25 rounded-control px-5 py-4"><p className="text-good text-body-lg">{notice}</p></div>}
            <Button pill size="lg" fullWidth type="submit" loading={loading} disabled={!email.trim() || !password}>{loading ? 'Signing in...' : 'Sign in'}</Button>
            <div className="flex items-center gap-4 text-body-sm text-charcoal/70" aria-hidden="true">
              <span className="h-px flex-1 bg-charcoal/15" />or<span className="h-px flex-1 bg-charcoal/15" />
            </div>
            <Button pill size="lg" fullWidth variant="secondary" onClick={onOpenJoin}>Join with venue code</Button>
          </form>
        )}

        <p className="text-body-lg text-charcoal/75 mt-10">
          Don't have an account? <Button variant="link" onClick={onSignUp}>Sign up</Button>
        </p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, venueSlug, authLoading, signInWithEmail, selectVenue } = useAuth()
  const location = useLocation()

  // Wait for the splash screen to finish before triggering entrance animations
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && window.__peliknSplashDone === true)
  // useLayoutEffect fires before the browser paints — ensures landing-ready
  // class is added in the same frame as the event, with no extra render gap
  useLayoutEffect(() => {
    if (ready) return
    // Re-check the flag before subscribing — the splash can finish between
    // this component's first render and this effect running, and the event
    // would then already have been dispatched and missed.
    if (window.__peliknSplashDone === true) { setReady(true); return }
    const onDone = () => setReady(true)
    window.addEventListener('pk-splash-done', onDone, { once: true })
    // Safety net only — see the matching note in LoginPage. Was 5200 ms.
    const fallback = setTimeout(() => setReady(true), 800)
    return () => { window.removeEventListener('pk-splash-done', onDone); clearTimeout(fallback) }
  }, [ready])

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [error, setError]               = useState('')
  const [notice, setNotice]             = useState(location.state?.notice ?? '')
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
      navigate(`/v/${slug}/dashboard`, { replace: true })
      return
    }

    // Multi-venue — show picker
    setLoading(false)
    setPendingVenues(list)
    setView('picker')
  }

  const handlePickVenue = (slug) => {
    selectVenue(slug)
    navigate(`/v/${slug}/dashboard`, { replace: true })
  }

  const handleForgotPassword = async () => {
    setError('')
    setNotice('')
    const address = email.trim()
    if (!address) {
      setError('Enter your email first')
      return
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    if (err) {
      setError(err.message)
      return
    }
    setNotice('Reset link sent — check your email')
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
        <LogoLoader tone="onBrand" />
      </div>
    )
  }

  if (!isNativeApp()) {
    return (
      <WebLogin
        view={view} setView={setView}
        email={email} setEmail={setEmail} password={password} setPassword={setPassword}
        error={error} setError={setError} notice={notice} setNotice={setNotice}
        loading={loading} onSubmit={handleSubmit} onForgot={handleForgotPassword}
        pendingVenues={pendingVenues} onPickVenue={handlePickVenue}
        joinCode={joinCode} setJoinCode={setJoinCode} joinError={joinError} setJoinError={setJoinError}
        joinLoading={joinLoading} onJoin={handleJoin} onOpenSignIn={openSignIn} onOpenJoin={openJoin}
        onSignUp={() => navigate('/signup')}
      />
    )
  }

  return (
    <div className="pelikn-ios-login">
      <div className={`pelikn-ios-card${ready ? ' landing-ready' : ''}`}>
          <div className="pelikn-ios-motion" aria-hidden="true" />
          <div className="pelikn-ios-flow pelikn-ios-flow-one" aria-hidden="true" />

          <div className="pelikn-ios-brand">
            <div className="pelikn-ios-mark"><Logo variant="mark" height={44} tone="onBrand" /></div>
            <p>Sign in to Pelikn</p>
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
                {loading ? 'Signing in...' : 'Sign in'}
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
  )
}
