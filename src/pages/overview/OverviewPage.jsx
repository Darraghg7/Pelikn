import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Link, Navigate } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAuth } from '../../contexts/AuthContext'
import { useAllVenueCompliance, STATUS_ORDER } from '../../hooks/useAllVenueCompliance'
import Button from '../../components/ui/Button'

// Up to this many venues sit side by side as cards, each with its own Needs
// you list. From one more, the page becomes a sortable list instead — past
// five, cards no longer fit one laptop screen and scanning them gets slow.
// Agreed with Darragh, 22 Oct 2026.
export const CARD_VIEW_MAX = 5

/* ── Status ──────────────────────────────────────────────────────────────── */
const STATUS = {
  urgent:    { label: 'Urgent',          dot: 'bg-bad',  text: 'text-bad dark:text-badDark' },
  attention: { label: 'Needs attention', dot: 'bg-warn', text: 'text-warn dark:text-warnDark' },
  review:    { label: 'To review',       dot: 'bg-info', text: 'text-info dark:text-infoDark' },
  clear:     { label: 'All clear',       dot: 'bg-good', text: 'text-good dark:text-goodDark' },
  closed:    { label: 'Closed today',    dot: 'bg-ink4 dark:bg-white/30', text: 'text-ink3 dark:text-white/55' },
  error:     { label: "Couldn't load",   dot: 'bg-ink4 dark:bg-white/30', text: 'text-ink3 dark:text-white/55' },
}

const URGENCY_DOT = { danger: 'bg-bad', warn: 'bg-warn', info: 'bg-info' }

const CARD = 'bg-white dark:bg-paperDark rounded-card border border-line dark:border-white/10'

function StatusDot({ status, className = '' }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS[status].dot} ${className}`} />
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="stroke-ink4 dark:stroke-white/30 shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function closedText(closed) {
  return typeof closed === 'string' ? `Closed today · ${closed}` : 'Closed today'
}

/* ── Small group: one card per venue ─────────────────────────────────────── */

// Tailwind needs whole class names, so each group size gets its own.
const CARD_GRID = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
  5: 'md:grid-cols-2 lg:grid-cols-3',
}

function CardStat({ label, value, tone }) {
  return (
    <div className="flex-1 min-w-0 px-4 py-3 border-r last:border-r-0 border-line dark:border-white/10">
      <div className={`text-title font-semibold tabular-nums leading-none ${tone ?? 'text-ink dark:text-white'}`}>{value}</div>
      <div className="font-mono text-micro uppercase tracking-[0.08em] text-ink3 dark:text-white/55 mt-1.5 truncate">{label}</div>
    </div>
  )
}

function VenueCard({ result, isHome, onOpen }) {
  const { venue, status, summary, actions, closed, uses } = result
  const st = STATUS[status]
  const to = (route) => `/v/${venue.slug}${route}`

  const fridgesLogged = summary ? summary.totalFridges - summary.uncheckedFridges : 0
  const stats = summary ? [
    uses.rota     && { label: 'On shift', value: summary.onShiftToday },
    uses.checks   && { label: 'Checks', value: `${Math.min(summary.checksToday, summary.totalChecks)}/${summary.totalChecks}`, tone: summary.checksToday === 0 && !closed ? 'text-warn dark:text-warnDark' : undefined },
    uses.fridges  && { label: 'Fridges', value: `${fridgesLogged}/${summary.totalFridges}`, tone: summary.uncheckedFridges > 0 ? 'text-warn dark:text-warnDark' : undefined },
  ].filter(Boolean) : []

  return (
    <div className={`${CARD} flex flex-col overflow-hidden`}>
      <Link
        to={to('/dashboard')}
        onClick={() => onOpen(venue.slug)}
        className="flex items-start gap-3 px-5 pt-4 pb-3.5 hover:bg-ink/[0.03] dark:hover:bg-white/5 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-title-sm font-semibold text-ink dark:text-white truncate m-0">{venue.name}</h2>
            {isHome && (
              <span className="font-mono text-micro uppercase tracking-[0.08em] text-brand dark:text-white/70 bg-brand-tint dark:bg-white/10 px-1.5 py-0.5 rounded-tag shrink-0">You're here</span>
            )}
          </div>
          <div className={`flex items-center gap-1.5 mt-1 text-body-sm font-medium ${st.text}`}>
            <StatusDot status={status} />
            {status === 'closed' ? closedText(closed) : st.label}
            {actions.length > 0 && <span className="text-ink3 dark:text-white/55 font-normal">· {actions.length} to do</span>}
          </div>
        </div>
        <span className="mt-1.5"><Chevron /></span>
      </Link>

      <div className="flex-1 border-t border-line dark:border-white/10">
        {status === 'error' ? (
          <p className="px-5 py-4 text-body-sm text-ink3 dark:text-white/55 m-0">This venue's numbers didn't load. Open it to check directly.</p>
        ) : actions.length === 0 ? (
          <div className="px-5 py-4 flex items-center gap-2 text-body-sm text-ink3 dark:text-white/55">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="stroke-good dark:stroke-goodDark shrink-0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {closed ? 'Nothing to do while closed' : 'Nothing needs you here'}
          </div>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-line dark:divide-white/10">
            {actions.map((a, i) => (
              <li key={a.id}>
                <Link
                  to={to(a.route)}
                  onClick={() => onOpen(venue.slug)}
                  className="flex items-center gap-2.5 px-5 py-3 hover:bg-ink/[0.03] dark:hover:bg-white/5 transition-colors"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${URGENCY_DOT[a.urgency]}`} />
                  <span className={`flex-1 min-w-0 text-body-sm text-ink dark:text-white ${i === 0 && a.urgency === 'danger' ? 'font-semibold' : 'font-medium'}`}>{a.label}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {stats.length > 0 && (
        <div className="flex border-t border-line dark:border-white/10">
          {stats.map(s => <CardStat key={s.label} {...s} />)}
        </div>
      )}
    </div>
  )
}

function CardSkeleton() {
  return <div className={`${CARD} h-[240px] animate-pulse`} />
}

/* ── Large group: summary + sortable list ────────────────────────────────── */

const FILTERS = [
  { key: 'needYou', label: 'Need you',  match: r => r.status === 'urgent' || r.status === 'attention', tone: 'text-bad dark:text-badDark' },
  { key: 'clear',   label: 'On track',  match: r => r.status === 'clear' || r.status === 'review',     tone: 'text-good dark:text-goodDark' },
  { key: 'closed',  label: 'Closed',    match: r => r.status === 'closed',                             tone: 'text-ink dark:text-white' },
]

// A dash, not a zero, where the venue doesn't use the thing at all.
const COLUMNS = [
  { key: 'checks',   label: 'Opening checks', short: 'Checks',  uses: 'checks',
    sortValue: s => s.totalChecks ? s.checksToday / s.totalChecks : 2,
    render: s => `${Math.min(s.checksToday, s.totalChecks)}/${s.totalChecks}`,
    bad: (s, closed) => !closed && s.checksToday === 0 },
  { key: 'fridges',  label: 'Fridges due',    short: 'Fridges', uses: 'fridges',
    sortValue: s => -s.uncheckedFridges, render: s => s.uncheckedFridges || '—', bad: s => s.uncheckedFridges > 0 },
  { key: 'cleaning', label: 'Overdue cleans', short: 'Cleans',  uses: 'cleaning',
    sortValue: s => -s.overdueClean, render: s => s.overdueClean || '—', bad: s => s.overdueClean > 0 },
  { key: 'critical', label: 'Critical',       short: 'Critical', uses: 'critical',
    sortValue: s => -s.criticalActions, render: s => s.criticalActions || '—', bad: s => s.criticalActions > 0 },
  { key: 'leave',    label: 'Leave to review', short: 'Leave',  uses: 'leave',
    sortValue: s => -s.pendingLeave, render: s => s.pendingLeave || '—', info: s => s.pendingLeave > 0 },
  { key: 'onShift',  label: 'On shift',       short: 'On shift', uses: 'rota',
    sortValue: s => -s.onShiftToday, render: s => s.onShiftToday },
]

const GRID_COLS = 'md:grid-cols-[minmax(0,2.4fr)_repeat(6,minmax(0,1fr))_20px]'

function SummaryCell({ filter, value, active, onClick, loading }) {
  // Raw button: a segmented filter, the kind the Button ratchet leaves as is.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 min-w-0 text-left px-5 py-4 border-r border-line dark:border-white/10 transition-colors ${active ? 'bg-ink/5 dark:bg-white/8' : 'hover:bg-ink/[0.03] dark:hover:bg-white/5'}`}
    >
      <span className={`block text-display font-semibold tabular-nums leading-none ${filter.tone}`}>
        {loading ? '–' : value}
      </span>
      <span className="block font-mono text-micro uppercase tracking-[0.08em] text-ink3 dark:text-white/55 mt-1.5">{filter.label}</span>
    </button>
  )
}

function SortHeader({ col, sort, onSort }) {
  const active = sort.key === col.key
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(col.key)}
      aria-label={`Sort by ${col.label}`}
      title={col.label}
      className="justify-self-end -mr-3"
    >
      {col.short}{active ? (sort.dir === 1 ? ' ↓' : ' ↑') : ''}
    </Button>
  )
}

function VenueRow({ result, isHome, onOpen }) {
  const { venue, status, summary, actions, closed, uses } = result
  const st = STATUS[status]
  const subline = status === 'error' ? "Couldn't load"
    : status === 'closed' ? closedText(closed)
      : actions[0]?.label ?? 'All clear'
  const more = actions.length > 1 ? ` +${actions.length - 1} more` : ''

  return (
    <li>
      <Link
        to={`/v/${venue.slug}/dashboard`}
        onClick={() => onOpen(venue.slug)}
        className={`grid grid-cols-[minmax(0,1fr)_auto_20px] ${GRID_COLS} items-center gap-x-3 px-5 py-3 hover:bg-ink/[0.03] dark:hover:bg-white/5 transition-colors`}
      >
        <div className="min-w-0 flex items-start gap-2.5">
          <StatusDot status={status} className="mt-[7px]" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-body font-semibold text-ink dark:text-white truncate">{venue.name}</span>
              {isHome && <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink3 dark:text-white/55 shrink-0">Here</span>}
            </div>
            <div className={`text-caption truncate ${actions.length ? st.text : 'text-ink3 dark:text-white/55'}`}>
              {subline}<span className="text-ink3 dark:text-white/55">{more}</span>
            </div>
          </div>
        </div>

        {/* Phones: one count instead of six columns */}
        <span className={`md:hidden text-body-sm font-semibold tabular-nums ${st.text}`}>
          {actions.length > 0 ? actions.length : ''}
        </span>

        {COLUMNS.map(col => {
          const usesIt = summary && uses[col.uses]
          const tone = !usesIt ? 'text-ink4 dark:text-white/25'
            : col.bad?.(summary, closed) ? 'text-bad dark:text-badDark font-semibold'
              : col.info?.(summary) ? 'text-info dark:text-infoDark font-semibold'
                : 'text-ink2 dark:text-white/80'
          return (
            <span key={col.key} className={`hidden md:block text-right text-body-sm tabular-nums ${tone}`}>
              {usesIt ? col.render(summary) : '—'}
            </span>
          )
        })}
        <Chevron />
      </Link>
    </li>
  )
}

function VenueList({ results, homeSlug, onOpen, aggregate, loading, venueCount }) {
  const [filter, setFilter] = useState(null)
  const [query, setQuery]   = useState('')
  const [sort, setSort]     = useState({ key: 'status', dir: 1 })

  const onSort = (key) => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = FILTERS.find(x => x.key === filter)
    const list = results.filter(r => (!f || f.match(r)) && (!q || r.venue.name.toLowerCase().includes(q)))
    const col = COLUMNS.find(c => c.key === sort.key)
    const byStatus = (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.actions.length - a.actions.length
    const value = (r) => (col && r.summary && r.uses[col.uses] ? col.sortValue(r.summary) : null)
    return [...list].sort((a, b) => {
      if (col) {
        const va = value(a), vb = value(b)
        // Venues that don't use this column stay at the bottom either way.
        if (va === null || vb === null) return (va === null) - (vb === null) || byStatus(a, b)
        return (va - vb) * sort.dir || byStatus(a, b) || a.venue.name.localeCompare(b.venue.name)
      }
      return byStatus(a, b) * sort.dir || a.venue.name.localeCompare(b.venue.name)
    })
  }, [results, filter, query, sort])

  const counts = { needYou: aggregate.needYou, clear: aggregate.clear, closed: aggregate.closed }

  return (
    <>
      <div className={`${CARD} flex overflow-hidden mb-3`}>
        {FILTERS.map(f => (
          <SummaryCell
            key={f.key}
            filter={f}
            value={counts[f.key]}
            active={filter === f.key}
            loading={loading}
            onClick={() => setFilter(prev => prev === f.key ? null : f.key)}
          />
        ))}
        <div className="hidden sm:flex flex-1 flex-col gap-1.5 px-5 py-4">
          <span className="text-display font-semibold tabular-nums leading-none text-ink dark:text-white">{loading ? '–' : aggregate.onShift}</span>
          <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink3 dark:text-white/55">On shift now</span>
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-line dark:border-white/10">
          <input
            type="search"
            placeholder="Find a venue…"
            aria-label="Find a venue"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-2 rounded-control border border-line dark:border-white/15 bg-white dark:bg-paperDark text-sm text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/20 dark:focus:ring-white/20 w-full sm:w-64"
          />
          <span className="text-caption text-ink3 dark:text-white/55 sm:ml-auto">
            {rows.length === venueCount ? `${venueCount} venues` : `${rows.length} of ${venueCount} venues`}
            {sort.key !== 'status' && (
              <> · <Button variant="link" onClick={() => setSort({ key: 'status', dir: 1 })}>worst first</Button></>
            )}
            {filter && (
              <> · <Button variant="link" onClick={() => setFilter(null)}>show all</Button></>
            )}
          </span>
        </div>

        <div className={`hidden md:grid ${GRID_COLS} items-center gap-x-3 px-5 py-2 border-b border-line dark:border-white/10`}>
          <span className="text-body-sm text-ink3 dark:text-white/55 pl-[18px]">Venue</span>
          {COLUMNS.map(col => <SortHeader key={col.key} col={col} sort={sort} onSort={onSort} />)}
          <span />
        </div>

        {loading && results.length === 0 ? (
          <div className="divide-y divide-line dark:divide-white/10">
            {Array.from({ length: Math.min(venueCount, 8) }, (_, i) => (
              <div key={i} className="h-[58px] animate-pulse bg-ink/[0.02] dark:bg-white/[0.03]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-body-sm text-ink3 dark:text-white/55 m-0">No venues match.</p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-line dark:divide-white/10">
            {rows.map(r => (
              <VenueRow key={r.venue.id} result={r} isHome={r.venue.slug === homeSlug} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

/** The page body, without the data fetching — picks cards or the list by group size. */
export function OverviewLayout({ results, aggregate, loading, venueCount, homeSlug, onOpen, skeletonVenues = [] }) {
  const cardView = venueCount <= CARD_VIEW_MAX

  const sortedCards = useMemo(() =>
    [...results].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
  [results])

  const headline = loading
    ? `${venueCount} venues`
    : aggregate.needYou === 0
      ? `All ${venueCount} venues on track`
      : `${aggregate.needYou} of ${venueCount} venues need you`

  return (
    <div className="max-w-[1280px] mx-auto">
      <div className="mb-5">
        <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink3 dark:text-white/55 m-0">
          Group overview · {format(new Date(), 'EEEE d MMMM')}
        </p>
        <h1 className="text-display font-semibold tracking-[-0.028em] text-ink dark:text-white mt-1.5 mb-0">
          {greeting()}
        </h1>
        <p className="text-body text-ink2 dark:text-white/70 mt-1 mb-0">
          {headline}
          {cardView && !loading && aggregate.onShift > 0 && ` · ${aggregate.onShift} on shift`}
        </p>
      </div>

      {cardView ? (
        <div className={`grid grid-cols-1 ${CARD_GRID[venueCount] ?? CARD_GRID[2]} gap-3`}>
          {loading && results.length === 0
            ? skeletonVenues.map(v => <CardSkeleton key={v.id} />)
            : sortedCards.map(r => (
                <VenueCard key={r.venue.id} result={r} isHome={r.venue.slug === homeSlug} onOpen={onOpen} />
              ))}
        </div>
      ) : (
        <VenueList
          results={results}
          homeSlug={homeSlug}
          onOpen={onOpen}
          aggregate={aggregate}
          loading={loading}
          venueCount={venueCount}
        />
      )}
    </div>
  )
}

export default function OverviewPage() {
  const { isManager } = useSession()
  const { venueSlug, venuePlan } = useVenue()
  const { venues, selectVenue } = useAuth()

  const allVenues = venues ?? []
  const isMultiVenue = isManager && allVenues.length > 1

  // All hooks must run before the single-venue redirect below — `venues` resolves
  // asynchronously, so isMultiVenue flips false → true after mount.
  const { results, aggregate, loading } = useAllVenueCompliance(isMultiVenue ? allVenues : [], venuePlan)

  if (!isMultiVenue) return <Navigate to={`/v/${venueSlug}/dashboard`} replace />

  return (
    <OverviewLayout
      results={results}
      aggregate={aggregate}
      loading={loading}
      venueCount={allVenues.length}
      homeSlug={venueSlug}
      onOpen={selectVenue}
      skeletonVenues={allVenues}
    />
  )
}
