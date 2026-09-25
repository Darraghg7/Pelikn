import React from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'

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
      <div className={`flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 shrink-0 ${flush ? 'pb-3 border-b border-line dark:border-white/10' : 'pb-2'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {status && !badge && <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[status] ?? 'bg-ink4'}`} />}
          <p className="text-[12px] min-[420px]:text-[13px] font-semibold tracking-[0.06em] min-[420px]:tracking-[0.08em] uppercase text-ink3 dark:text-white/45 truncate">{title}</p>
          {badge}
        </div>
        {aside ?? (href && (
          linkLabel ? (
            <Link to={href} className="shrink-0 text-[15px] font-semibold text-ink dark:text-white hover:opacity-70 transition-opacity">
              {linkLabel}
            </Link>
          ) : (
            <Link to={href} aria-label={`Open ${title}`} className="shrink-0 w-8 h-8 -mr-2 inline-flex items-center justify-center text-ink3 dark:text-white/45 hover:text-ink dark:hover:text-white">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          )
        ))}
      </div>
      <div className={`flex-1 ${flush ? '' : 'px-4 sm:px-5 pb-4'}`}>{children}</div>
    </div>
  )
}

/** Small red/amber pill after a widget title, e.g. "21 overdue". */
export function TitleBadge({ tone = 'bad', children }) {
  const cls = tone === 'bad'
    ? 'bg-badBg text-bad dark:bg-bad/25 dark:text-[#f19a86]'
    : 'bg-warnBg text-warn dark:bg-warn/20 dark:text-[#e8b06a]'
  return <span className={`shrink-0 h-7 px-2.5 rounded-full inline-flex items-center text-sm font-semibold normal-case tracking-normal ${cls}`}>{children}</span>
}

export function BigNumber({ value, label, alert }) {
  return (
    <div className="py-1">
      <p className={`font-mono text-[34px] leading-tight font-semibold ${alert ? 'text-bad dark:text-[#f19a86]' : 'text-ink dark:text-white'}`}>{value}</p>
      {label && <p className="text-sm text-ink3 dark:text-white/45 mt-0.5">{label}</p>}
    </div>
  )
}

/** Label / value line. warn = red value; good = green value (e.g. a reassuring 0). */
export function MiniRow({ label, value, warn, good }) {
  const tone = warn ? 'text-bad dark:text-[#f19a86]' : good ? 'text-good dark:text-[#7fd1a4]' : 'text-ink dark:text-white'
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[15px] text-ink2 dark:text-white/75">{label}</span>
      <span className={`font-mono text-[16px] font-semibold ${tone}`}>{value}</span>
    </div>
  )
}
