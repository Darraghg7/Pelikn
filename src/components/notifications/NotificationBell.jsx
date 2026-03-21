import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'

const TYPE_ICON = {
  swap_request:       '🔄',
  late_clock_in:      '⏰',
  incomplete_tasks:   '✗',
  repeat_offender:    '⚠',
  fridge_alert:       '🌡',
  fridge_unchecked:   '❄',
  training_expired:   '📋',
  training_expiring:  '📋',
  cleaning_overdue:   '🧹',
  critical_action:    '🚨',
  major_action:       '⚠',
  probe_overdue:      '🔬',
  time_off_pending:   '🏖',
}

/**
 * variant: 'light' = cream icon (for dark backgrounds like mobile header)
 *          'dark'  = charcoal icon (for light backgrounds like the sidebar)
 */
export default function NotificationBell({ variant = 'light' }) {
  const { isManager } = useSession()
  const { venueSlug } = useVenue()
  const { notifications, count } = useNotifications(isManager)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isManager) return null

  const visible = count > 0 && !dismissed
  const iconColor  = variant === 'dark' ? 'text-charcoal/60 dark:text-white/60' : 'text-cream/70'
  const hoverColor = variant === 'dark' ? 'hover:bg-charcoal/8 dark:hover:bg-white/10' : 'hover:bg-cream/10'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setDismissed(false) }}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${hoverColor}`}
        aria-label={`Notifications${visible ? ` (${count} unread)` : ''}`}
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconColor}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {visible && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm ring-1 ring-white dark:ring-[#1a1a18]">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-11 w-80 bg-white rounded-xl shadow-lg border border-charcoal/10 z-50 overflow-hidden ${variant === 'dark' ? 'left-0' : 'right-0'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal/8">
            <p className="text-xs font-semibold tracking-widest uppercase text-charcoal/50">
              Notifications
            </p>
            {count > 0 && (
              <button
                onClick={() => { setDismissed(true); setOpen(false) }}
                className="text-[10px] tracking-widest uppercase text-charcoal/35 hover:text-charcoal/60 transition-colors"
              >
                Dismiss all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-charcoal/30">All clear — no alerts</p>
            </div>
          ) : (
            <ul className="divide-y divide-charcoal/6 max-h-80 overflow-y-auto">
              {notifications.map(n => (
                <li key={n.id}>
                  <Link
                    to={`/v/${venueSlug}${n.link}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-charcoal/3 transition-colors"
                  >
                    <span className="text-base mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
                    <p className="text-sm text-charcoal leading-snug">{n.message}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
