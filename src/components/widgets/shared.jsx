import React from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import LoadingSpinner from '../ui/LoadingSpinner'
import Button from '../ui/Button'

/**
 * Card frame shared by every dashboard widget.
 *
 * title      upper-case label, e.g. "Cleaning"
 * badge      optional node right after the title, e.g. a "21 overdue" pill
 * to         route the header links to
 * linkLabel  text for that link ("View all", "Rota"); omitted → a chevron
 * aside      node for the header's right side instead of a link, e.g. "3 new"
 * flush      body has no side padding — for lists whose rows run edge to edge
 * status     legacy dot next to the title (kept for widgets that still pass it)
 */
export function WidgetShell({ title, badge, to, linkLabel, aside, flush = false, status, children }) {
  const { venueSlug } = useVenue()
  const statusDot = { good: 'bg-good', warning: 'bg-warn', bad: 'bg-bad' }
  const href = to && venueSlug ? `/v/${venueSlug}${to}` : to
  return (
    <div className="bg-white dark:bg-paperDark rounded-2xl border border-line dark:border-white/10 overflow-hidden h-full flex flex-col">
      <div className={`flex items-center justify-between gap-2.5 px-3.5 sm:px-3.5 pt-2.5 shrink-0 ${flush ? 'pb-2.5 border-b border-line dark:border-white/10' : 'pb-2'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {status && !badge && <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[status] ?? 'bg-ink4'}`} />}
          <p className="text-caption font-semibold tracking-[0.06em] min-[420px]:tracking-[0.08em] uppercase text-ink3 dark:text-white/45 truncate">{title}</p>
          {badge}
        </div>
        {aside ?? (href && (
          linkLabel ? (
            <Link to={href} className="shrink-0 text-body-sm font-semibold text-ink dark:text-white hover:opacity-70 transition-opacity">
              {linkLabel}
            </Link>
          ) : (
            <Link to={href} aria-label={`Open ${title}`} className="shrink-0 w-8 h-7 -mr-2 inline-flex items-center justify-center text-ink3 dark:text-white/45 hover:text-ink dark:hover:text-white">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          )
        ))}
      </div>
      <div className={`flex-1 ${flush ? '' : 'px-3.5 sm:px-3.5 pb-3'}`}>{children}</div>
    </div>
  )
}

/** Small red/amber pill after a widget title, e.g. "21 overdue". */
export function TitleBadge({ tone = 'bad', children }) {
  const cls = tone === 'bad'
    ? 'bg-badBg text-bad dark:bg-bad/25 dark:text-badDark'
    : 'bg-warnBg text-warn dark:bg-warn/20 dark:text-warnDark'
  return <span className={`shrink-0 h-7 px-2.5 rounded-full inline-flex items-center text-body-sm font-semibold normal-case tracking-normal ${cls}`}>{children}</span>
}

export function BigNumber({ value, label, alert }) {
  return (
    <div className="py-1">
      <p className={`font-mono text-title leading-tight font-semibold ${alert ? 'text-bad dark:text-badDark' : 'text-ink dark:text-white'}`}>{value}</p>
      {label && <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">{label}</p>}
    </div>
  )
}

/** Label / value line. warn = red value; good = green value (e.g. a reassuring 0). */
export function MiniRow({ label, value, warn, good }) {
  const tone = warn ? 'text-bad dark:text-badDark' : good ? 'text-good dark:text-goodDark' : 'text-ink dark:text-white'
  return (
    <div className="flex items-center justify-between gap-2.5 py-1.5">
      <span className="text-body-sm text-ink2 dark:text-white/75">{label}</span>
      <span className={`font-mono text-body-sm font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

/**
 * Body for a widget with no data yet: a spinner while loading, or a retry
 * once the read has failed (useWidgetQuery reports the error). Without this a
 * failed read either spun forever or, worse, rendered as zeros.
 */
export function WidgetPending({ isError, onRetry, className = 'py-4' }) {
  if (isError) {
    return (
      <div role="alert" className="py-2 text-center">
        <p className="text-sm text-danger/80">Couldn’t load this.</p>
        <Button variant="link" size="sm" onClick={() => onRetry?.()} className="mt-1">
          Try again
        </Button>
      </div>
    )
  }
  return <div className={`flex justify-center ${className}`}><LoadingSpinner /></div>
}
