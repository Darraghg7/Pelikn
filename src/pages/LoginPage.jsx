import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'
import { useVenue } from '../contexts/VenueContext'
import { useAuth } from '../contexts/AuthContext'
import { FullPageLoader } from '../components/ui/LoadingSpinner'

const ROLE_LABEL = {
  owner:   'Owner',
  manager: 'Manager',
  staff:   'Staff',
}

export default function LoginPage() {
  const { signIn, signOut, session, loading } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()
  const { signOutVenue } = useAuth()
  const navigate = useNavigate()

  const [staff, setStaff]             = useState([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [selected, setSelected]       = useState(null)   // staff row
  const [pin, setPin]                 = useState('')
  const [error, setError]             = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const pinRef = useRef(null)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && session) navigate(`/v/${venueSlug}/dashboard`, { replace: true })
  }, [loading, session, navigate, venueSlug])

  // Fetch staff — load from cache immediately, fetch fresh in background
  useEffect(() => {
    if (!venueId) { setStaffLoading(false); return }

    const cacheKey = `safeserv_staff_${venueId}`

    // Show cached list immediately (works offline)
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setStaff(JSON.parse(cached))
        setStaffLoading(false)
      }
    } catch { /* corrupt cache — ignore */ }

    let cancelled = false
    supabase
      .from('staff')
      .select('id, name, role, photo_url')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        if (cancelled || !data) return
        localStorage.setItem(cacheKey, JSON.stringify(data))
        setStaff(data)
      })
      .catch(() => { /* offline — already showing cached list */ })
      .finally(() => { if (!cancelled) setStaffLoading(false) })
    return () => { cancelled = true }
  }, [venueId])

  const selectStaff = (member) => {
    setSelected(member)
    setPin('')
    setError('')
    setTimeout(() => pinRef.current?.focus(), 50)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selected || pin.length < 4) return
    setSubmitting(true)
    setError('')
    const { error: err } = await signIn(selected.id, pin, venueId, venueSlug)
    if (err) {
      setError('Incorrect PIN — try again')
      setPin('')
      setSubmitting(false)
      pinRef.current?.focus()
    }
    // On success SessionContext sets session -> useEffect above redirects
  }

  if (loading) return <FullPageLoader />

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-5 py-10 font-sans">

      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="font-serif text-brand text-4xl tracking-tight">SafeServ</h1>
        {venueName && (
          <p className="text-sm font-medium text-charcoal/60 mt-1">{venueName}</p>
        )}
        <p className="text-xs tracking-widest text-charcoal/40 uppercase mt-1">Food Safety, Simplified</p>
        <p className="text-[10px] tracking-widest text-charcoal/25 uppercase mt-0.5">Food Safety &amp; Operations</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-charcoal/8 p-6 flex flex-col gap-6">

        {/* Staff picker */}
        <div>
          <p className="text-[11px] tracking-widest font-semibold text-charcoal/40 uppercase mb-3">
            Select Staff Member
          </p>
          <div className="flex flex-col gap-2">
            {staffLoading && (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 border-t-brand animate-spin" />
              </div>
            )}
            {!staffLoading && staff.length === 0 && (
              <p className="text-sm text-charcoal/40 text-center py-4">No staff members found for this venue.</p>
            )}
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStaff(s)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                  selected?.id === s.id
                    ? 'border-accent bg-accent/5 ring-1 ring-accent'
                    : 'border-charcoal/10 hover:border-charcoal/25 bg-white',
                ].join(' ')}
              >
                {/* Avatar */}
                {s.photo_url ? (
                  <img src={s.photo_url} alt={s.name}
                    className="w-9 h-9 rounded-full object-cover shrink-0 border border-charcoal/10" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-charcoal/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-charcoal/50">{s.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <span className="flex-1 font-semibold text-charcoal text-sm">{s.name}</span>
                <span className={[
                  'text-[11px] uppercase tracking-widest font-medium',
                  selected?.id === s.id ? 'text-accent' : 'text-charcoal/35',
                ].join(' ')}>
                  {ROLE_LABEL[s.role] ?? s.role}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PIN entry — shown once a staff member is selected */}
        {selected && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <p className="text-[11px] tracking-widest font-semibold text-charcoal/40 uppercase mb-2">PIN</p>
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
                placeholder="Enter PIN"
                className={[
                  'w-full px-4 py-3 rounded-xl border bg-white text-charcoal text-sm font-mono tracking-[0.4em] placeholder:tracking-normal placeholder:font-sans placeholder:text-charcoal/30 outline-none transition-colors',
                  error ? 'border-red-400 focus:border-red-400' : 'border-charcoal/15 focus:border-brand dark:focus:border-accent',
                ].join(' ')}
              />
              {error && (
                <p className="text-red-500 text-xs mt-1.5">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pin.length < 4 || submitting}
              className="w-full bg-brand text-cream py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-brand/90 dark:bg-charcoal dark:hover:bg-charcoal/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>

      {/* Sign out of venue — returns device to landing page */}
      <button
        onClick={async () => {
          signOut()
          await signOutVenue()
          navigate('/login', { replace: true })
        }}
        className="mt-6 text-xs text-charcoal/30 hover:text-charcoal/60 transition-colors"
      >
        Sign out of venue
      </button>
    </div>
  )
}
