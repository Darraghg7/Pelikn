import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'
import { useVenue } from '../contexts/VenueContext'
import { useAuth } from '../contexts/AuthContext'
import { FullPageLoader } from '../components/ui/LoadingSpinner'
import { DEVICE_VENUES_KEY } from '../lib/constants'
import { captureSilent } from '../lib/reportError'
import { staffListState } from '../lib/loginScreenState'
import Avatar from '../components/ui/Avatar'
import Button, { CloseButton } from '../components/ui/Button'

// ── Device venue helpers ──────────────────────────────────────────────────────
function readDeviceVenues() {
  try {
    const raw = localStorage.getItem(DEVICE_VENUES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writeDeviceVenues(venues) {
  try { localStorage.setItem(DEVICE_VENUES_KEY, JSON.stringify(venues)) } catch { /* storage unavailable (private mode / quota) — preference just won't persist */ }
}

// ── VenuePicker (post-login, multi-linked-venue) ──────────────────────────────
function VenuePicker({ venues, currentSlug, onSelect }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs tracking-widest font-semibold text-charcoal/40 dark:text-white/35 uppercase">
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
                : 'border-charcoal/10 dark:border-white/10 hover:border-charcoal/25 dark:hover:border-white/25 bg-white dark:bg-paperDark',
            ].join(' ')}
          >
            <span className="font-semibold text-charcoal dark:text-white text-sm">{v.name}</span>
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

    // A failed lookup isn't "no such venue" — don't tell staff their code is wrong.
    const lookupFailed = (error) => {
      captureSilent(error, 'LoginPage:venue-code-lookup')
      setErrorMsg('We couldn’t reach Pelikn. Check your connection and try again.')
      setStatus('error')
    }

    const { data: groupVenues, error: groupError } = await supabase
      .from('venues')
      .select('id, slug, name')
      .eq('group_code', trimmed)
    if (groupError) { lookupFailed(groupError); return }

    if (groupVenues?.length) {
      setFound(groupVenues)
      setStatus('found')
      return
    }

    const { data: slugVenue, error: slugError } = await supabase
      .from('venues')
      .select('id, slug, name')
      .eq('slug', trimmed)
      .maybeSingle()
    if (slugError) { lookupFailed(slugError); return }

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
      className="fixed inset-0 z-50 bg-charcoal/50 dark:bg-white/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white dark:bg-paperDark rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <p className="text-xs tracking-widest uppercase font-semibold text-charcoal/40 dark:text-white/35 mb-0.5">Add a venue</p>
          <h2 className="text-lg font-bold text-charcoal dark:text-white">Enter venue code</h2>
          <p className="text-xs text-charcoal/45 dark:text-white/40 mt-1 leading-relaxed">
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
              'w-full px-4 py-3 rounded-xl border bg-white dark:bg-paperDark text-charcoal dark:text-white text-sm font-mono tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none transition-colors',
              status === 'error' ? 'border-danger' : 'border-charcoal/15 dark:border-white/15 focus:border-brand',
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
              <p className="text-xs tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">
                {found.length} venues found
              </p>
            )}
            {found.map(v => {
              const exists = existingSlugs.has(v.slug)
              return (
                <div key={v.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${exists ? 'border-charcoal/8 dark:border-white/8 bg-charcoal/2 dark:bg-white/3' : 'border-brand/20 bg-brand/4'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${exists ? 'bg-charcoal/20 dark:bg-white/20' : 'bg-brand'}`} />
                  <span className={`flex-1 text-sm font-semibold ${exists ? 'text-charcoal/40 dark:text-white/35' : 'text-charcoal dark:text-white'}`}>{v.name}</span>
                  {exists && <span className="text-xs uppercase tracking-widest text-charcoal/30 dark:text-white/30 font-semibold">Added</span>}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2">
          {status !== 'found' || newVenues.length === 0 ? (
            <Button
              onClick={lookup}
              disabled={!code.trim() || status === 'loading'}
              className="flex-1"
            >
              {status === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Looking up…
                </span>
              ) : 'Look up code'}
            </Button>
          ) : (
            <Button
              onClick={() => onAdd(newVenues)}
              className="flex-1"
            >
              Add {newVenues.length === 1 ? newVenues[0].name : `${newVenues.length} venues`} →
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
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
        className="flex-1 relative flex items-center rounded-xl p-[3px] overflow-x-auto scrollbar-hide bg-brand/5 dark:bg-white/5"
      >
        {/* Sliding pill */}
        <div
          className="bg-brand dark:bg-brand-400 shadow-[0_1px_6px_theme(colors.brand.DEFAULT/20%)]"
          style={{
            position: 'absolute',
            top: 3,
            height: 'calc(100% - 6px)',
            left: pill.left,
            width: pill.width || 0,
            borderRadius: 9,
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
              className={`relative flex-shrink-0 border-none whitespace-nowrap font-semibold transition-colors text-[12.5px] cursor-pointer bg-transparent ${isActive ? 'text-white' : 'text-brand/50 dark:text-white/45'}`}
              style={{
                zIndex: 1,
                padding: '7px 14px',
                borderRadius: 9,
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
        className="flex-shrink-0 flex items-center justify-center transition-all bg-transparent border border-brand/10 text-brand/30 dark:border-white/10 dark:text-white/35"
        style={{
          width: 32, height: 32,
          borderRadius: 9,
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
            className={`border-2 ${error
              ? 'border-bad dark:border-badDark bg-transparent'
              : filled
                ? 'bg-brand border-brand dark:bg-white dark:border-white shadow-[0_0_6px_theme(colors.brand.DEFAULT/20%)]'
                : 'bg-transparent border-brand/20 dark:border-white/25'}`}
            style={{
              width: 12, height: 12, borderRadius: 6,
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
              'h-14 rounded-xl border text-charcoal dark:text-white font-medium transition-all active:scale-95',
              k === '⌫'
                ? 'text-charcoal/50 dark:text-white/40 text-xl border-charcoal/8 dark:border-white/8 bg-charcoal/4 dark:bg-white/5 hover:bg-charcoal/8 dark:hover:bg-white/8'
                : 'text-2xl border-charcoal/8 dark:border-white/8 bg-charcoal/4 dark:bg-white/5 hover:bg-charcoal/8 dark:hover:bg-white/8',
            ].join(' ')}
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}

// ── Staff list states ─────────────────────────────────────────────────────────
// Placeholder rows shaped like the real ones, so the card doesn't jump when
// names arrive.
function StaffListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading team">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3 ${i < 2 ? 'border-b border-charcoal/10 dark:border-white/10' : ''}`}
        >
          <div className="w-9 h-9 rounded-full bg-charcoal/10 dark:bg-white/10 animate-pulse shrink-0" />
          <div className="h-3 rounded bg-charcoal/10 dark:bg-white/10 animate-pulse" style={{ width: `${[46, 38, 52][i]}%` }} />
          <div className="ml-auto h-2.5 w-10 rounded bg-charcoal/5 dark:bg-white/5 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function ListMessage({ title, body, action }) {
  return (
    <div className="px-4 py-5 text-center" role="status">
      <p className="text-sm font-semibold text-charcoal dark:text-white">{title}</p>
      <p className="text-[12px] leading-relaxed text-charcoal/60 dark:text-white/55 mt-1 mb-4">{body}</p>
      {action}
    </div>
  )
}

// ── Role label ────────────────────────────────────────────────────────────────
const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', staff: 'Staff' }

// How long a PIN sign-in may spin before the page stops waiting and tells the
// user to try again (see doSignIn).
const SIGN_IN_TIMEOUT_MS = 20_000

/**
 * Staff picker list for the login screen, which runs with no session.
 *
 * Any device can load it: list_venue_staff_for_login() (113) is callable by
 * the anon key and returns only id, name, role, photo_url and (from 147)
 * rota colour for one venue's active staff. Before 147 is applied colour is
 * missing and Avatar falls back to the default colour. No manager sign-in is
 * needed to set a device up first.
 *
 * There used to be a fallback to a direct `staff` table read for while 113
 * was being rolled out. Since 113 and 116 are live, anon can't read that
 * table at all, so the fallback only ever turned a failed RPC into a silent
 * empty list. Errors now throw so the screen can offer a retry.
 */
async function fetchLoginStaff(venueId) {
  const { data, error } = await supabase.rpc('list_venue_staff_for_login', { p_venue_id: venueId })
  if (error) throw error
  return data ?? []
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { signIn, signOut, switchVenue, session, loading } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()
  const { user: authUser, authLoading, signOutVenue } = useAuth()
  const navigate = useNavigate()

  // Entrance animation
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && window.__peliknSplashDone === true)
  useLayoutEffect(() => {
    if (ready) return
    // Re-check the flag before subscribing — the splash can finish between
    // this component's first render and this effect running, and the event
    // would then already have been dispatched and missed.
    if (window.__peliknSplashDone === true) { setReady(true); return }
    const onDone = () => setReady(true)
    window.addEventListener('pk-splash-done', onDone, { once: true })
    // Safety net only. Every element on this screen is opacity:0 until
    // `ready`, so this timeout is literally how long a user stares at a blank
    // login screen if the event never arrives. It used to be 5200 ms, which
    // is exactly what happened on web where the splash never runs.
    const fallback = setTimeout(() => setReady(true), 800)
    return () => { window.removeEventListener('pk-splash-done', onDone); clearTimeout(fallback) }
  }, [ready])

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
  const [staffFailed, setStaffFailed]   = useState(false)
  const [staffAttempt, setStaffAttempt] = useState(0)
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
    setStaffFailed(false)
    setSelected(null)
    setPin('')
    setError('')

    const cacheKey = `pelikn_staff_${venueId}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setStaff(JSON.parse(cached)); setStaffLoading(false) }
    } catch { /* no usable cache — the fetch below fills the list */ }

    let cancelled = false
    fetchLoginStaff(venueId)
      .then((data) => {
        if (cancelled) return
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* storage full — the offline cache is best-effort */ }
        setStaff(data)
      })
      .catch((e) => {
        if (cancelled) return
        // A cached list stays on screen (see staffListState); with no cache
        // this shows the retry state instead of an empty box.
        setStaffFailed(true)
        captureSilent(e, 'LoginPage:staff-list-refresh')
      })
      .finally(() => { if (!cancelled) setStaffLoading(false) })
    return () => { cancelled = true }
  }, [venueId, staffAttempt])

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

    // signIn has no overall deadline: the pin-login call has no timeout, and
    // each follow-up read can take up to 20 s. When the database jammed
    // (26 Sep 2026) that left staff on a spinner indefinitely. Give up on
    // waiting after SIGN_IN_TIMEOUT_MS so they can retry. The attempt itself
    // isn't cancelled: if it succeeds late, the session effect above still
    // moves them to the dashboard, and a late error is simply dropped.
    let timer
    const timedOut = new Promise(resolve => {
      timer = setTimeout(() => resolve({ timedOut: true }), SIGN_IN_TIMEOUT_MS)
    })
    const result = await Promise.race([signIn(selected.id, pinValue, venueId, venueSlug), timedOut])
    clearTimeout(timer)
    if (result.timedOut) {
      setError("Couldn't reach the server, please try again")
      setPin('')
      setSubmitting(false)
      return
    }

    const { error: err, linkedVenues } = result
    if (err) {
      const msg = err.message ?? ''
      if (/too many failed/i.test(msg)) {
        setError(msg.replace('Too many failed attempts — try again after', 'Account locked, try again at'))
      } else if (/inactive/i.test(msg)) {
        setError('This account has been deactivated. Contact your manager.')
      } else if (/incorrect pin|invalid credentials/i.test(msg)) {
        setError('Incorrect PIN, try again')
      } else if (err.code === 'CONNECTION') {
        setError(msg)
      } else {
        // Anything else is not the PIN's fault. Saying "Incorrect PIN" here
        // is what hid the Sep 2026 login outage behind a wrong-PIN message.
        setError("Couldn't sign in. Please try again.")
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
    navigate(`/v/${venue.slug}/dashboard`, { replace: true })
  }

  // doSignIn is rebuilt every render; the numpad calls it through a ref so the
  // 4th digit always signs in with the current person and venue, even though
  // handleDigit itself stays stable.
  const doSignInRef = useRef(doSignIn)
  doSignInRef.current = doSignIn

  // Numpad handlers
  const handleDigit = useCallback((d) => {
    if (submitting) return
    setError('')
    setPin(prev => {
      if (prev.length >= 4) return prev
      const next = prev + d
      if (next.length === 4) setTimeout(() => doSignInRef.current(next), 80)
      return next
    })
  }, [submitting])

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }, [])

  if (loading) return <FullPageLoader />

  const showTabs     = deviceVenues.length > 1
  const listState    = staffListState({ loading: staffLoading, failed: staffFailed, staff })
  // Only a manager/owner email sign-in on this device has anything to sign
  // out of here: a staff PIN session never sees this screen (it redirects to
  // the dashboard above).
  const showSignOut  = !authLoading && !!authUser
  const filteredStaff = staffQuery
    ? staff.filter(s => s.name.toLowerCase().includes(staffQuery.toLowerCase()))
    : staff

  return (
    <div
      className="min-h-dvh bg-surface dark:bg-bgDark flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:px-5 sm:py-10 font-sans overflow-y-auto"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <style>{`
        @keyframes login-logo-enter  { from { opacity:0; transform:translate3d(0,-16px,0) } to { opacity:1; transform:translate3d(0,0,0) } }
        @keyframes login-card-enter  { from { opacity:0; transform:translate3d(0,24px,0) }  to { opacity:1; transform:translate3d(0,0,0) } }
        @keyframes login-row-enter   { from { transform:translate3d(-10px,0,0) } to { transform:translate3d(0,0,0) } }
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
        <h1 className="font-bold text-brand dark:text-white text-4xl tracking-tight">Pelikn</h1>
        <p className="text-xs tracking-widest text-charcoal/40 dark:text-white/35 uppercase mt-1">Built for Hospitality</p>
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
        className="w-full max-w-sm bg-white dark:bg-paperDark rounded-2xl shadow-sm border border-charcoal/8 dark:border-white/8 overflow-hidden"
        style={ready ? { animation: 'login-card-enter 0.5s 0.08s cubic-bezier(.34,1.15,.64,1) both', willChange: 'transform, opacity' } : { opacity: 0 }}
      >
        {/* Venue name — single-venue only */}
        {!showTabs && venueName && (
          <div className="px-5 pt-5 pb-0">
            <p className="text-xl font-semibold text-charcoal dark:text-white">{venueName}</p>
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
            <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 dark:border-white/15 border-t-brand animate-spin" />
          </div>
        )}

        {!pickerVenues && !switching && (
          <>
            {/* Staff list section */}
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs tracking-widest font-semibold text-charcoal/40 dark:text-white/35 uppercase mb-3">
                Select Staff Member
              </p>

              {/* Search — only when >12 staff */}
              {staff.length > 12 && (
                <div className="relative mb-2">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/30 dark:text-white/30 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search name…"
                    value={staffQuery}
                    onChange={e => setStaffQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand/40 transition-all"
                  />
                  {staffQuery && (
                    <Button variant="ghost" size="sm" iconOnly aria-label="Clear search" onClick={() => setStaffQuery('')}
                      className="absolute right-1 top-1/2 -translate-y-1/2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </Button>
                  )}
                </div>
              )}

              {/* Staff rows */}
              <div className="flex flex-col border border-charcoal/8 dark:border-white/8 rounded-xl overflow-hidden">
                {listState === 'loading' && <StaffListSkeleton />}
                {listState === 'error' && (
                  <ListMessage
                    title="Couldn’t load your team"
                    body={typeof navigator !== 'undefined' && navigator.onLine === false
                      ? 'This device is offline. Reconnect to the internet, then try again.'
                      : 'We couldn’t reach Pelikn. Check your connection and try again.'}
                    action={
                      <Button
                        fullWidth
                        onClick={() => setStaffAttempt(a => a + 1)}
                      >
                        Try again
                      </Button>
                    }
                  />
                )}
                {listState === 'empty' && (
                  <ListMessage
                    title="No team members yet"
                    body={`Nobody at ${venueName ?? 'this venue'} can sign in with a PIN yet. A manager needs to add the team in Pelikn first.`}
                    action={
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={() => navigate('/login')}
                      >
                        Manager sign in
                      </Button>
                    }
                  />
                )}
                {listState === 'ready' && staff.length > 12 && staffQuery && filteredStaff.length === 0 && (
                  <p className="text-sm text-charcoal/40 dark:text-white/35 text-center py-6">No staff match "{staffQuery}"</p>
                )}
                {filteredStaff.map((s, i) => {
                  const isSel = selected?.id === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectStaff(s)}
                      className={[
                        'relative w-full flex items-center gap-3 px-4 py-3 text-left transition-all',
                        i < filteredStaff.length - 1 ? 'border-b border-charcoal/6 dark:border-white/8' : '',
                        isSel ? 'bg-accent/5' : 'hover:bg-charcoal/3 dark:hover:bg-white/5',
                      ].join(' ')}
                      style={ready ? { animation: `login-row-enter 0.38s ${0.14 + i * 0.045}s cubic-bezier(.22,.9,.28,1) both` } : { opacity: 0 }}
                    >
                      {/* Selected left accent bar */}
                      {isSel && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent rounded-r-[2px]" />
                      )}

                      {/* Avatar */}
                      <Avatar name={s.name} id={s.id} colour={s.colour} photoUrl={s.photo_url} size="md" decorative />

                      <span className="flex-1 font-semibold text-charcoal dark:text-white text-sm">{s.name}</span>
                      <span className={`text-xs uppercase tracking-widest font-semibold font-mono ${isSel ? 'text-accent' : 'text-charcoal/35 dark:text-white/30'}`}>
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
                className="border-t border-charcoal/8 dark:border-white/8 px-5 py-5 flex flex-col gap-4"
              >
                {/* Who's signing in header */}
                {(() => {
                  return (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={selected.name} id={selected.id} colour={selected.colour} photoUrl={selected.photo_url} size="sm" decorative />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-charcoal dark:text-white tracking-[-0.01em] truncate">{selected.name}</p>
                        <p className="text-xs uppercase tracking-[0.06em] font-mono text-charcoal/40 dark:text-white/35">{ROLE_LABEL[selected.role] ?? selected.role}</p>
                      </div>
                      <CloseButton label="Choose someone else" onClick={() => { setSelected(null); setPin(''); setError('') }} />
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
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => doSignIn(pin)}
                  disabled={pin.length < 4 || submitting}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Signing in…
                    </span>
                  ) : 'Sign In'}
                </Button>
              </div>
            )}

            {/* Add venue button — single-venue mode only */}
            {!showTabs && (
              <div className="px-5 pb-5">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setShowAddModal(true)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add another venue
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sign out — only when a manager/owner is signed in on this device */}
      {showSignOut && (
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            signOut()
            await signOutVenue()
            navigate('/login', { replace: true })
          }}
          className="mt-6"
          style={ready ? { animation: 'login-fade-enter 0.4s 0.3s ease both' } : { opacity: 0 }}
        >
          Sign out of venue
        </Button>
      )}
    </div>
  )
}
