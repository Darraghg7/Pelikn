import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { useSession } from '../../contexts/SessionContext'

const TYPE_ICON = {
  swap_request:     '🔄',
  late_clock_in:    '⏰',
  incomplete_tasks: '✗',
  repeat_offender:  '⚠',
}

export default function NotificationBell() {
  const { isManager } = useSession()
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setDismissed(false) }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-cream/10 transition-colors"
        aria-label="Notifications"
      >
        {/* Bell SVG */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream/70">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {visible && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-lg border border-charcoal/10 z-50 overflow-hidden">
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
                    to={n.link}
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
