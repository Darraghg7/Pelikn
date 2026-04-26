import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useNotifications } from '../../hooks/useNotifications'
import { useStaffNotifications } from '../../hooks/useStaffNotifications'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'

const _IC = (d) => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const TYPE_ICON = {
  swap_request:       _IC(<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>),
  late_clock_in:      _IC(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  overdue_break:      _IC(<><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></>),
  incomplete_tasks:   _IC(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  repeat_offender:    _IC(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  fridge_alert:       _IC(<><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></>),
  fridge_unchecked:   _IC(<><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/></>),
  training_expired:   _IC(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>),
  training_expiring:  _IC(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>),
  cleaning_overdue:   _IC(<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  critical_action:    _IC(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  major_action:       _IC(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  probe_overdue:      _IC(<><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></>),
  time_off_pending:   _IC(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  swap_approved:      _IC(<><polyline points="20 6 9 17 4 12"/></>),
  swap_rejected:      _IC(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  time_off_approved:  _IC(<><polyline points="20 6 9 17 4 12"/></>),
  time_off_rejected:  _IC(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  upcoming_shift:     _IC(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  hour_edit:          _IC(<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></>),
}

// ── Dismissal persistence ─────────────────────────────────────────────────────
const STORAGE_KEY = 'pelikn_dismissed_notifs'
const today = () => format(new Date(), 'yyyy-MM-dd')

function loadDismissed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function saveDismissed(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}
/** Returns true if this notification was dismissed today. */
function isDismissed(map, id) {
  return map[id] === today()
}
/** Mark a notification dismissed for today. */
function dismiss(map, id) {
  const next = { ...map, [id]: today() }
  saveDismissed(next)
  return next
}

// ── SwipeableNotif ────────────────────────────────────────────────────────────
function SwipeableNotif({ n, venueSlug, onDismiss, onNavigate }) {
  const [offset, setOffset]   = useState(0)
  const [leaving, setLeaving] = useState(false)
  const startX  = useRef(null)
  const itemRef = useRef(null)

  const animateOut = useCallback(() => {
    setLeaving(true)
    setTimeout(onDismiss, 260)
  }, [onDismiss])

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX }
  const onTouchMove  = (e) => {
    if (startX.current === null) return
    const dx = e.touches[0].clientX - startX.current
    if (dx < 0) setOffset(dx)  // only allow leftward swipe
  }
  const onTouchEnd   = () => {
    if (offset < -72) { animateOut() } else { setOffset(0) }
    startX.current = null
  }

  const revealWidth = Math.min(Math.abs(offset), 80)

  if (leaving) return null

  return (
    <li className="relative overflow-hidden">
      {/* Dismiss backing (revealed on swipe) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-danger text-white text-xs font-semibold transition-all duration-150"
        style={{ width: revealWidth }}
        aria-hidden
      >
        {revealWidth > 40 && 'Dismiss'}
      </div>

      {/* Notification row */}
      <div
        ref={itemRef}
        className="relative bg-white transition-transform duration-150 group"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Link
          to={`/v/${venueSlug}${n.link}`}
          onClick={onNavigate}
          className="flex items-start gap-3 px-4 py-3 hover:bg-charcoal/3 transition-colors pr-8"
        >
          <span className="mt-0.5 shrink-0 text-charcoal/50">{TYPE_ICON[n.type]}</span>
          <p className="text-sm text-charcoal leading-snug">{n.message}</p>
        </Link>
        {/* Desktop dismiss button — visible on hover */}
        <button
          onClick={(e) => { e.preventDefault(); animateOut() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-charcoal/25 hover:text-charcoal/60 hover:bg-charcoal/8 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </li>
  )
}

// ── NotificationBell ──────────────────────────────────────────────────────────
/**
 * variant: 'light' = cream icon (for dark backgrounds like mobile header)
 *          'dark'  = charcoal icon (for light backgrounds like the sidebar)
 */
export default function NotificationBell({ variant = 'light' }) {
  const { isManager, session } = useSession()
  const { venueSlug } = useVenue()
  const { notifications: managerNotifs } = useNotifications(isManager)
  const { notifications: staffNotifs }   = useStaffNotifications(session?.staffId)

  const [open, setOpen]           = useState(false)
  const [dismissedMap, setDismissedMap] = useState(loadDismissed)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allNotifs   = useMemo(() => [...managerNotifs, ...staffNotifs], [managerNotifs, staffNotifs])
  const visible     = useMemo(() => allNotifs.filter(n => !isDismissed(dismissedMap, n.id)), [allNotifs, dismissedMap])
  const count       = visible.length

  const dismissOne = useCallback((id) => {
    setDismissedMap(prev => dismiss(prev, id))
  }, [])

  const dismissAll = useCallback(() => {
    setDismissedMap(prev => {
      let next = { ...prev }
      for (const n of allNotifs) next = dismiss(next, n.id)
      return next
    })
    setOpen(false)
  }, [allNotifs])

  const iconColor  = variant === 'dark' ? 'text-charcoal/60 dark:text-white/60' : 'text-cream/70'
  const hoverColor = variant === 'dark' ? 'hover:bg-charcoal/8 dark:hover:bg-white/10' : 'hover:bg-cream/10'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${hoverColor}`}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconColor}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-danger text-white text-[11px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm ring-1 ring-white dark:ring-[#1a1a18]">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-11 w-80 bg-white rounded-2xl shadow-lg border border-charcoal/10 z-50 overflow-hidden ${variant === 'dark' ? 'left-0' : 'right-0'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal/8">
            <p className="text-xs font-semibold tracking-widest uppercase text-charcoal/50">
              Notifications
            </p>
            {count > 0 && (
              <button
                onClick={dismissAll}
                className="text-[11px] tracking-widest uppercase text-charcoal/35 hover:text-charcoal/60 transition-colors"
              >
                Dismiss all
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-charcoal/30">All clear — no alerts</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-charcoal/6 max-h-80 overflow-y-auto">
                {visible.map(n => (
                  <SwipeableNotif
                    key={n.id}
                    n={n}
                    venueSlug={venueSlug}
                    onDismiss={() => dismissOne(n.id)}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </ul>
              <p className="text-[10px] text-charcoal/25 text-center py-2 border-t border-charcoal/6">
                Swipe left to dismiss · Resets daily
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
