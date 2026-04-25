import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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
              <p className="text-[11px] text-charcoal/40 mt-0.5">safeserv.app/v/{v.slug}</p>
            </div>
            <span className="text-charcoal/25 group-hover:text-brand transition-colors text-lg leading-none">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Shield + checkmark icon used in the app icon and desktop card. */
function AppIcon({ size = 36, bgClass = 'bg-white/10 border border-white/15', strokeColor = 'rgba(26,60,46,0.9)' }) {
  return (
    <div className={`rounded-3xl ${bgClass} flex items-center justify-center`}
         style={{ width: size * 1.6, height: size * 1.6 }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path d="M18 4L6 9v8c0 7.5 5.1 14.5 12 16.5C25 31.5 30 24.5 30 17V9L18 4z"
              fill="white" fillOpacity="0.85" />
        <path d="M13 18l3.5 3.5L23 15"
              stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, venueSlug, authLoading, signInWithEmail, selectVenue } = useAuth()

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [error, setError]               = useState('')
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

    const { error: err, slug, venues: list } = await signInWithEmail(email.trim(), password)

    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Incorrect email or password'
        : err.message)
      setLoading(false)
      return
    }

    if (slug) {
      window.location.replace(`/v/${slug}`)
      return
    }

    // Multi-venue — show picker
    setLoading(false)
    setPendingVenues(list)
    setView('picker')
  }

  const handlePickVenue = (slug) => {
    selectVenue(slug)
    window.location.replace(`/v/${slug}`)
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
      setJoinError('Code not found — check with your manager')
      return
    }
    navigate(`/v/${data[0].slug}`)
  }

  const openSignIn = () => { setView('signin'); setError('') }
  const openJoin   = () => { setView('join'); setJoinCode(''); setJoinError('') }
  const closeSheet = () => { setView('welcome'); setError(''); setJoinError('') }

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-brand flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const isSheetOpen = view === 'signin' || view === 'join' || view === 'picker'

  return (
    <div className="min-h-dvh bg-brand font-sans flex flex-col">

      {/* ── MOBILE: full-screen welcome (hidden on md+) ───────────── */}
      <div className="flex-1 flex flex-col md:hidden"
           style={{ paddingTop: 'env(safe-area-inset-top)' }}>

        {/* Branding */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <AppIcon size={36} />
          <h1 className="font-bold text-white text-4xl tracking-tight mt-6">SafeServ</h1>
          <p className="text-white/50 tracking-widest uppercase text-xs mt-3">
            Food Safety, Simplified
          </p>
          <div className="flex items-center gap-2 mt-5 text-white/30 text-[11px]">
            <span>Checklists</span>
            <span>·</span>
            <span>Temperature logs</span>
            <span>·</span>
            <span>Rota</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="px-6 flex flex-col gap-3"
             style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => navigate('/signup')}
            className="w-full bg-surface text-brand rounded-2xl py-4 text-sm font-bold tracking-wide hover:bg-cream/90 transition-colors"
          >
            Get Started
          </button>
          <button
            onClick={openSignIn}
            className="w-full border border-white/20 text-white rounded-2xl py-4 text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={openJoin}
            className="w-full text-white/50 text-sm font-medium py-2 hover:text-white/80 transition-colors"
          >
            Join with venue code
          </button>
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
              strokeColor="white"
            />
            <h1 className="font-bold text-brand text-3xl tracking-tight mt-4">SafeServ</h1>
            <p className="text-xs tracking-widest uppercase text-charcoal/40 mt-1.5">
              Food Safety, Simplified
            </p>
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

      {/* ── MOBILE: bottom sheet overlay ──────────────────────────── */}
      <div
        className={[
          'fixed inset-0 bg-black/40 z-10 md:hidden transition-opacity duration-300',
          isSheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={view !== 'picker' ? closeSheet : undefined}
      />

      {/* Sheet */}
      <div
        className={[
          'fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-20 md:hidden',
          'transition-transform duration-300 ease-out',
          isSheetOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="w-10 h-1 bg-charcoal/12 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-6 pt-4 pb-6 flex flex-col gap-5">
          {view === 'picker' && pendingVenues ? (
            <VenuePicker venues={pendingVenues} onSelect={handlePickVenue} />
          ) : view === 'join' ? (
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
                    autoFocus
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
          ) : (
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
                <button type="button" onClick={closeSheet}
                  className="text-xs text-charcoal/35 hover:text-charcoal/60 transition-colors">
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
