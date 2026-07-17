import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'
import { useVenue } from '../contexts/VenueContext'
import { useAuth } from '../contexts/AuthContext'
import { FullPageLoader } from '../components/ui/LoadingSpinner'
import { DEVICE_VENUES_KEY } from '../lib/constants'
import { captureSilent } from '../lib/reportError'

// ── Device venue helpers ──────────────────────────────────────────────────────
function readDeviceVenues() {
  try {
    const raw = localStorage.getItem(DEVICE_VENUES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writeDeviceVenues(venues) {
  try { localStorage.setItem(DEVICE_VENUES_KEY, JSON.stringify(venues)) } catch {}
}

// ── Avatar colour palette (deterministic by staff id) ────────────────────────
const AVATAR_PALETTE = [
  { bg: '#e2f0e8', text: '#1f6b40' },
  { bg: '#ede9f7', text: '#6b46c1' },
  { bg: '#fde9e3', text: '#c94f2a' },
  { bg: '#e4eef9', text: '#2563ab' },
  { bg: '#fde8f2', text: '#b83280' },
  { bg: '#e3f4f7', text: '#0e7490' },
  { bg: '#fdf5e0', text: '#a16207' },
  { bg: '#f0e8e5', text: '#9b3a23' },
]

function avatarColors(id) {
  // IDs may be UUIDs (strings) or integers — hash to a consistent palette index
  const str = String(id ?? '')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function initials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── VenuePicker (post-login, multi-linked-venue) ──────────────────────────────
function VenuePicker({ venues, currentSlug, onSelect }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs tracking-widest font-semibold text-charcoal/40 uppercase">
        Where are you working today?
      </p>
      <div className="flex flex-col gap-2">
        {venues.map(v => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className={[
              'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
              v.slug === currentSlug
                ? 'border-accent bg-accent/5 ring-1 ring-accent'
                : 'border-charcoal/10 hover:border-charcoal/25 bg-white',
            ].join(' ')}
          >
            <span className="font-semibold text-charcoal text-sm">{v.name}</span>
            {v.slug === currentSlug && (
              <span className="text-xs uppercase tracking-widest font-medium text-accent">Here</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Add venue modal ───────────────────────────────────────────────────────────
function AddVenueModal({ currentDeviceVenues, onAdd, onClose }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [found, setFound] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const lookup = async () => {
    const trimmed = code.trim().toLowerCase()
    if (!trimmed) return
    setStatus('loading')
    setErrorMsg('')
    setFound([])

    const { data: groupVenues } = await supabase
      .from('venues')
      .select('id, slug, name')
      .eq('group_code', trimmed)

    if (groupVenues?.length) {
      setFound(groupVenues)
      setStatus('found')
      return
    }

    const { data: slugVenue } = await supabase
      .from('venues')
      .select('id, slug, name')
      .eq('slug', trimmed)
      .maybeSingle()

    if (slugVenue) {
      setFound([slugVenue])
      setStatus('found')
      return
    }

    setErrorMsg('No venue found for that code. Check the code and try again.')
    setStatus('error')
  }

  const handleKey = (e) => { if (e.key === 'Enter') lookup() }

  const existingSlugs = new Set(currentDeviceVenues.map(v => v.slug))
  const newVenues    = found.filter(v => !existingSlugs.has(v.slug))

  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <p className="text-xs tracking-widest uppercase font-semibold text-charcoal/40 mb-0.5">Add a venue</p>
          <h2 className="text-lg font-bold text-charcoal">Enter venue code</h2>
          <p className="text-xs text-charcoal/45 mt-1 leading-relaxed">
            Ask your manager for your venue code or group code.
          </p>
        </div>

        <div>
          <input
            ref={inputRef}
            value={code}
            onChange={e => { setCode(e.target.value); setStatus('idle'); setErrorMsg('') }}
            onKeyDown={handleKey}
            placeholder="e.g. the-oak-tavern"
            className={[
              'w-full px-4 py-3 rounded-xl border bg-white text-charcoal text-sm font-mono tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:text-charcoal/30 outline-none transition-colors',
              status === 'error' ? 'border-danger' : 'border-charcoal/15 focus:border-brand',
            ].join(' ')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {errorMsg && <p className="text-danger text-xs mt-1.5">{errorMsg}</p>}
        </div>

        {status === 'found' && found.length > 0 && (
          <div className="flex flex-col gap-2">
            {found.length > 1 && (
              <p className="text-xs tracking-widest uppercase text-charcoal/40 font-semibold">
                {found.length} venues found
              </p>
            )}
            {found.map(v => {
              const exists = existingSlugs.has(v.slug)
              return (
                <div key={v.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${exists ? 'border-charcoal/8 bg-charcoal/2' : 'border-brand/20 bg-brand/4'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${exists ? 'bg-charcoal/20' : 'bg-brand'}`} />
                  <span className={`flex-1 text-sm font-semibold ${exists ? 'text-charcoal/40' : 'text-charcoal'}`}>{v.name}</span>
                  {exists && <span className="text-xs uppercase tracking-widest text-charcoal/30 font-semibold">Added</span>}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2">
          {status !== 'found' || newVenues.length === 0 ? (
            <button
              onClick={lookup}
              disabled={!code.trim() || status === 'loading'}
              className="flex-1 bg-brand text-white py-3 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40"
            >
              {status === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Looking up…
                </span>
              ) : 'Look up code'}
            </button>
          ) : (
            <button
              onClick={() => onAdd(newVenues)}
              className="flex-1 bg-brand text-white py-3 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
            >
              Add {newVenues.length === 1 ? newVenues[0].name : `${newVenues.length} venues`} →
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:border-charcoal/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SlidingVenueTabs ──────────────────────────────────────────────────────────
// Animated pill indicator that slides between venue tabs.
function SlidingVenueTabs({ venues, activeSlug, onSelect, onAdd }) {
  const trackRef = useRef(null)
  const btnRefs  = useRef({})
  const [pill, setPill] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const btn   = btnRefs.current[activeSlug]
      const track = trackRef.current
      if (!btn || !track) return
      const tr = track.getBoundingClientRect()
      const br = btn.getBoundingClientRect()
      setPill({ left: br.left - tr.left, width: br.width })
    })
    return () => cancelAnimationFrame(raf)
  }, [activeSlug, venues.length])

  return (
    <div className="flex items-center gap-2">
      {/* Scrollable track */}
      <div
        ref={trackRef}
        className="flex-1 relative flex items-center rounded-xl p-[3px] overflow-x-auto scrollbar-hide"
        style={{ background: 'rgba(28,47,42,0.05)' }}
      >
        {/* Sliding pill */}
        <div
          style={{
            position: 'absolute',
            top: 3,
            height: 'calc(100% - 6px)',
            left: pill.left,
            width: pill.width || 0,
            borderRadius: 9,
            background: '#13362a',
            boxShadow: '0 1px 6px rgba(19,54,42,0.2)',
            transition: 'left 0.22s cubic-bezier(0.34,1.4,0.64,1), width 0.15s ease',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        {venues.map(v => {
          const isActive = v.slug === activeSlug
          return (
            <button
              key={v.slug}
              ref={el => { btnRefs.current[v.slug] = el }}
              onClick={() => onSelect(v.slug)}
              className="relative flex-shrink-0 border-none whitespace-nowrap font-semibold transition-colors text-[12.5px] cursor-pointer"
              style={{
                zIndex: 1,
                padding: '7px 14px',
                borderRadius: 9,
                background: 'transparent',
                color: isActive ? '#ffffff' : 'rgba(28,47,42,0.5)',
                transition: 'color 0.18s',
              }}
            >
              {v.name}
            </button>
          )
        })}
      </div>

      {/* Add venue button */}
      <button
        onClick={onAdd}
        title="Add another venue"
        className="flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          width: 32, height: 32,
          borderRadius: 9,
          border: '1px solid rgba(28,47,42,0.10)',
          background: 'transparent',
          color: 'rgba(28,47,42,0.30)',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  )
}

// ── PIN dots ──────────────────────────────────────────────────────────────────
function PINDots({ length, error }) {
  return (
    <div className="flex gap-3 items-center justify-center py-1">
      {[0, 1, 2, 3].map(i => {
        const filled = i < length
        return (
          <div
            key={i}
            style={{
              width: 12, height: 12, borderRadius: 6,
              background: filled && !error ? '#13362a' : 'transparent',
              border: `2px solid ${error ? '#b3331c' : filled ? '#13362a' : 'rgba(28,47,42,0.18)'}`,
              boxShadow: filled && !error ? '0 0 6px rgba(19,54,42,0.2)' : 'none',
              transition: 'all 0.12s',
              transform: filled ? 'scale(1.1)' : 'scale(1)',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Numpad ────────────────────────────────────────────────────────────────────
function Numpad({ onDigit, onDelete }) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫']
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {keys.map((k, i) => {
        if (k === null) return <div key={i} />
        return (
          <button
            key={i}
            type="button"
            onClick={() => k === '⌫' ? onDelete() : onDigit(String(k))}
            className={[
              'h-14 rounded-xl border text-charcoal font-medium transition-all active:scale-95',
              k === '⌫'
                ? 'text-charcoal/50 text-xl border-charcoal/8 bg-charcoal/4 hover:bg-charcoal/8'
                : 'text-2xl border-charcoal/8 bg-charcoal/4 hover:bg-charcoal/8',
            ].join(' ')}
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}

// ── Role label ────────────────────────────────────────────────────────────────
const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', staff: 'Staff' }

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { signIn, signOut, switchVenue, session, loading } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()
  const { signOutVenue } = useAuth()
  const navigate = useNavigate()

  // Entrance animation
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && window.__peliknSplashDone === true)
  useLayoutEffect(() => {
    if (ready) return
    const onDone = () => setReady(true)
    window.addEventListener('pk-splash-done', onDone, { once: true })
    const fallback = setTimeout(() => setReady(true), 5200)
    return () => { window.removeEventListener('pk-splash-done', onDone); clearTimeout(fallback) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Device venue list ──────────────────────────────────────────────────────
  const [deviceVenues, setDeviceVenues] = useState(() => readDeviceVenues())

  useEffect(() => {
    if (!venueId || !venueSlug || !venueName) return
    setDeviceVenues(prev => {
      if (prev.some(v => v.slug === venueSlug)) return prev
      const next = [...prev, { id: venueId, slug: venueSlug, name: venueName }]
      writeDeviceVenues(next)
      return next
    })
  }, [venueId, venueSlug, venueName])

  const [showAddModal, setShowAddModal] = useState(false)

  const handleAddVenues = useCallback((newVenues) => {
    setDeviceVenues(prev => {
      const existingSlugs = new Set(prev.map(v => v.slug))
      const toAdd = newVenues.filter(v => !existingSlugs.has(v.slug))
      const next = [...prev, ...toAdd]
      writeDeviceVenues(next)
      return next
    })
    setShowAddModal(false)
    if (newVenues.length > 0) navigate(`/v/${newVenues[0].slug}`, { replace: true })
  }, [navigate])

  const handleTabSelect = useCallback((slug) => {
    if (slug === venueSlug) return
    signOut()
    navigate(`/v/${slug}`, { replace: true })
  }, [venueSlug, signOut, navigate])

  // ── Staff list ────────────────────────────────────────────────────────────
  const [staff, setStaff]               = useState([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffQuery, setStaffQuery]     = useState('')
  const [selected, setSelected]         = useState(null)
  const [pin, setPin]                   = useState('')
  const [error, setError]               = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [pickerVenues, setPickerVenues] = useState(null)
  const [switching, setSwitching]       = useState(false)
  const pinSectionRef = useRef(null)

  useEffect(() => {
    if (!loading && session && !pickerVenues) {
      navigate(`/v/${venueSlug}/dashboard`, { replace: true })
    }
  }, [loading, session, navigate, venueSlug, pickerVenues])

  useEffect(() => {
    if (!venueId) { setStaffLoading(false); return }
    setStaff([])
    setStaffLoading(true)
    setSelected(null)
    setPin('')
    setError('')

    const cacheKey = `pelikn_staff_${venueId}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setStaff(JSON.parse(cached)); setStaffLoading(false) }
    } catch {}

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
      .catch((e) => captureSilent(e, 'LoginPage:staff-list-refresh'))
      .finally(() => { if (!cancelled) setStaffLoading(false) })
    return () => { cancelled = true }
  }, [venueId])

  const selectStaff = (member) => {
    setSelected(s => s?.id === member.id ? null : member)
    setPin('')
    setError('')
    if (selected?.id !== member.id) {
      setTimeout(() => {
        pinSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }

  const doSignIn = async (pinValue) => {
    if (!selected || pinValue.length < 4 || submitting) return
    setSubmitting(true)
    setError('')
    const { error: err, linkedVenues } = await signIn(selected.id, pinValue, venueId, venueSlug)
    if (err) {
      const msg = err.message ?? ''
      if (/too many failed/i.test(msg)) {
        setError(msg.replace('Too many failed attempts — try again after', 'Account locked, try again at'))
      } else if (/inactive/i.test(msg)) {
        setError('This account has been deactivated. Contact your manager.')
      } else {
        setError('Incorrect PIN, try again')
      }
      setPin('')
      setSubmitting(false)
      return
    }
    if ((linkedVenues ?? []).length > 1) {
      setPickerVenues(linkedVenues)
      setSubmitting(false)
      return
    }
  }

  const handlePickVenue = async (venue) => {
    if (venue.slug === venueSlug) {
      navigate(`/v/${venueSlug}/dashboard`, { replace: true })
      return
    }
    setSwitching(true)
    const { error: err } = await switchVenue(venue.id, venue.slug)
    if (err) { setSwitching(false); return }
    window.location.replace(`/v/${venue.slug}/dashboard`)
  }

  // Numpad handlers
  const handleDigit = useCallback((d) => {
    if (submitting) return
    setError('')
    setPin(prev => {
      if (prev.length >= 4) return prev
      const next = prev + d
      if (next.length === 4) setTimeout(() => doSignIn(next), 80)
      return next
    })
  }, [submitting, selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }, [])

  if (loading) return <FullPageLoader />

  const showTabs     = deviceVenues.length > 1
  const filteredStaff = staffQuery
    ? staff.filter(s => s.name.toLowerCase().includes(staffQuery.toLowerCase()))
    : staff

  return (
    <div
      className="min-h-dvh bg-surface flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:px-5 sm:py-10 font-sans overflow-y-auto"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <style>{`
        @keyframes login-logo-enter  { from { opacity:0; transform:translate3d(0,-16px,0) } to { opacity:1; transform:translate3d(0,0,0) } }
        @keyframes login-card-enter  { from { opacity:0; transform:translate3d(0,24px,0) }  to { opacity:1; transform:translate3d(0,0,0) } }
        @keyframes login-row-enter   { from { opacity:0; transform:translate3d(-10px,0,0) } to { opacity:1; transform:translate3d(0,0,0) } }
        @keyframes login-fade-enter  { from { opacity:0 } to { opacity:1 } }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none }
        .scrollbar-hide::-webkit-scrollbar { display:none }
      `}</style>

      {showAddModal && (
        <AddVenueModal
          currentDeviceVenues={deviceVenues}
          onAdd={handleAddVenues}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Logo */}
      <div
        className="mb-5 sm:mb-8 text-center shrink-0"
        style={ready ? { animation: 'login-logo-enter 0.45s cubic-bezier(.22,.9,.28,1) both', willChange: 'transform, opacity' } : { opacity: 0 }}
      >
        <h1 className="font-bold text-brand text-4xl tracking-tight">Pelikn</h1>
        <p className="text-xs tracking-widest text-charcoal/40 uppercase mt-1">Built for Hospitality</p>
      </div>

      {/* Sliding venue tabs */}
      {showTabs && (
        <div
          className="w-full max-w-sm mb-3"
          style={ready ? { animation: 'login-fade-enter 0.35s 0.05s ease both' } : { opacity: 0 }}
        >
          <SlidingVenueTabs
            venues={deviceVenues}
            activeSlug={venueSlug}
            onSelect={handleTabSelect}
            onAdd={() => setShowAddModal(true)}
          />
        </div>
      )}

      {/* Login card */}
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-charcoal/8 overflow-hidden"
        style={ready ? { animation: 'login-card-enter 0.5s 0.08s cubic-bezier(.34,1.15,.64,1) both', willChange: 'transform, opacity' } : { opacity: 0 }}
      >
        {/* Venue name — single-venue only */}
        {!showTabs && venueName && (
          <div className="px-5 pt-5 pb-0">
            <p className="text-xl font-semibold text-charcoal">{venueName}</p>
          </div>
        )}

        {/* Post-login venue picker */}
        {pickerVenues && (
          <div className="p-5">
            <VenuePicker venues={pickerVenues} currentSlug={venueSlug} onSelect={handlePickVenue} />
          </div>
        )}

        {switching && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 border-t-brand animate-spin" />
          </div>
        )}

        {!pickerVenues && !switching && (
          <>
            {/* Staff list section */}
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs tracking-widest font-semibold text-charcoal/40 uppercase mb-3">
                Select Staff Member
              </p>

              {/* Search — only when >12 staff */}
              {staff.length > 12 && (
                <div className="relative mb-2">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/30 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search name…"
                    value={staffQuery}
                    onChange={e => setStaffQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-charcoal/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand/40 transition-all"
                  />
                  {staffQuery && (
                    <button type="button" onClick={() => setStaffQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              )}

              {/* Staff rows */}
              <div className="flex flex-col border border-charcoal/8 rounded-xl overflow-hidden">
                {staffLoading && (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 border-t-brand animate-spin" />
                  </div>
                )}
                {!staffLoading && staff.length === 0 && (
                  <p className="text-sm text-charcoal/40 text-center py-6">No staff members found for this venue.</p>
                )}
                {!staffLoading && staff.length > 12 && staffQuery && filteredStaff.length === 0 && (
                  <p className="text-sm text-charcoal/40 text-center py-6">No staff match "{staffQuery}"</p>
                )}
                {filteredStaff.map((s, i) => {
                  const isSel = selected?.id === s.id
                  const av    = avatarColors(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectStaff(s)}
                      className={[
                        'relative w-full flex items-center gap-3 px-4 py-3 text-left transition-all',
                        i < filteredStaff.length - 1 ? 'border-b border-charcoal/6' : '',
                        isSel ? 'bg-accent/5' : 'hover:bg-charcoal/3',
                      ].join(' ')}
                      style={ready ? { animation: `login-row-enter 0.38s ${0.14 + i * 0.045}s cubic-bezier(.22,.9,.28,1) both` } : { opacity: 0 }}
                    >
                      {/* Selected left accent bar */}
                      {isSel && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent rounded-r-[2px]" />
                      )}

                      {/* Avatar */}
                      {s.photo_url ? (
                        <img
                          src={s.photo_url}
                          alt={s.name}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-charcoal/10"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                          style={{ background: av.bg, color: isSel ? '#c94f2a' : av.text }}
                        >
                          {initials(s.name)}
                        </div>
                      )}

                      <span className="flex-1 font-semibold text-charcoal text-sm">{s.name}</span>
                      <span className={`text-xs uppercase tracking-widest font-semibold font-mono ${isSel ? 'text-accent' : 'text-charcoal/35'}`}>
                        {ROLE_LABEL[s.role] ?? s.role}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* PIN section */}
            {selected && (
              <div
                ref={pinSectionRef}
                className="border-t border-charcoal/8 px-5 py-5 flex flex-col gap-4"
              >
                {/* Who's signing in header */}
                {(() => {
                  const av = avatarColors(selected.id)
                  return (
                    <div className="flex items-center gap-2.5">
                      {selected.photo_url ? (
                        <img src={selected.photo_url} alt={selected.name}
                          className="w-8 h-8 shrink-0 object-cover border border-charcoal/10"
                          style={{ borderRadius: 9 }} loading="lazy" />
                      ) : (
                        <div
                          className="w-8 h-8 shrink-0 flex items-center justify-center font-mono text-xs font-bold"
                          style={{ borderRadius: 9, background: av.bg, color: av.text }}
                        >
                          {initials(selected.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-charcoal tracking-[-0.01em] truncate">{selected.name}</p>
                        <p className="text-xs uppercase tracking-[0.06em] font-mono text-charcoal/40">{ROLE_LABEL[selected.role] ?? selected.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelected(null); setPin(''); setError('') }}
                        className="flex items-center justify-center text-charcoal/30 hover:text-charcoal/60 transition-colors"
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(28,47,42,0.12)', flexShrink: 0 }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  )
                })()}

                {/* PIN dots */}
                <PINDots length={pin.length} error={!!error} />

                {error && (
                  <p className="text-danger text-xs text-center -mt-2">{error}</p>
                )}

                {/* Numpad */}
                <Numpad onDigit={handleDigit} onDelete={handleDelete} />

                {/* Sign in button */}
                <button
                  type="button"
                  onClick={() => doSignIn(pin)}
                  disabled={pin.length < 4 || submitting}
                  className="w-full bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold tracking-wide hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Signing in…
                    </span>
                  ) : 'Sign In'}
                </button>
              </div>
            )}

            {/* Add venue button — single-venue mode only */}
            {!showTabs && (
              <div className="px-5 pb-5">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-charcoal/15 text-[12px] font-semibold text-charcoal/35 hover:text-brand hover:border-brand/30 hover:bg-brand/3 transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add another venue
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={async () => {
          signOut()
          await signOutVenue()
          navigate('/login', { replace: true })
        }}
        className="mt-6 text-xs text-charcoal/30 hover:text-charcoal/60 transition-colors"
        style={ready ? { animation: 'login-fade-enter 0.4s 0.3s ease both' } : { opacity: 0 }}
      >
        Sign out of venue
      </button>
    </div>
  )
}
