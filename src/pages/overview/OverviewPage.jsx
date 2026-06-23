import React, { useState } from 'react'
import { format } from 'date-fns'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAuth } from '../../contexts/AuthContext'
import { useAllVenueCompliance } from '../../hooks/useAllVenueCompliance'
import { Navigate } from 'react-router-dom'

/* ── Status helpers ──────────────────────────────────────────────────────────── */
const STATUS = {
  green: { dotClass: 'bg-success',  label: 'All clear',       topBarClass: 'bg-success',  textClass: 'text-success'  },
  amber: { dotClass: 'bg-warning',  label: 'Needs attention', topBarClass: 'bg-warning',  textClass: 'text-warning'  },
  red:   { dotClass: 'bg-danger',   label: 'Checks missing',  topBarClass: 'bg-danger',   textClass: 'text-danger'   },
  gray:  { dotClass: 'bg-charcoal/25', label: 'Loading…',     topBarClass: 'bg-charcoal/25', textClass: 'text-charcoal/40' },
}

function statusFor(result) {
  return STATUS[result.status] ?? STATUS.gray
}

/* ── Check indicator (22×22 circle) ─────────────────────────────────────────── */
function CheckDot({ done, label }) {
  return (
    <div className="flex flex-col items-center gap-[3px]">
      <div className={[
        'w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold',
        done ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
      ].join(' ')}>
        {done ? '✓' : '✕'}
      </div>
      <span className="text-[8px] font-semibold text-charcoal/40 text-center leading-[1.2]">
        {label}
      </span>
    </div>
  )
}

/* ── Footer stat cell ────────────────────────────────────────────────────────── */
function StatCell({ value, label, colorClass, last }) {
  return (
    <div className={`flex-1 pl-3.5 py-2.5 ${last ? '' : 'border-r border-charcoal/8'}`}>
      <div className={`text-[17px] font-bold tabular-nums leading-none ${colorClass ?? 'text-charcoal'}`}>
        {value}
      </div>
      <div className="text-[9px] font-semibold text-charcoal/40 mt-[1px]">
        {label}
      </div>
    </div>
  )
}

/* ── Venue card ──────────────────────────────────────────────────────────────── */
function VenueCard({ result, isHome, dimmed, onOpen }) {
  const [hovered, setHovered] = useState(false)
  const { venue, data, status, loading } = result
  const st = statusFor(result)

  const checks = [
    { label: 'Fridge AM', done: data?.fridgeAM },
    { label: 'Fridge PM', done: data?.fridgePM },
    { label: 'H·Hold AM', done: data?.hotHoldingAM },
    { label: 'H·Hold PM', done: data?.hotHoldingPM },
  ]

  const pendingCount = data?.pendingTimeOff?.length ?? 0

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !dimmed && onOpen(venue.slug)}
      className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-charcoal/8 overflow-hidden flex flex-col"
      style={{
        cursor: dimmed ? 'default' : 'pointer',
        opacity: dimmed ? 0.20 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transform: hovered && !dimmed ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered && !dimmed ? '0 8px 24px rgba(0,0,0,0.10)' : 'none',
        transition: 'transform 150ms, box-shadow 150ms, opacity 150ms',
      }}
    >
      <div className={`h-[3px] rounded-t-2xl ${st.topBarClass}`} />

      <div className="p-[14px_16px_10px]">
        <div className="text-sm font-bold text-charcoal overflow-hidden text-ellipsis whitespace-nowrap">
          {venue.name}
        </div>
        <div className={`text-[10px] font-bold mt-0.5 ${st.textClass}`}>
          {loading ? 'Loading…' : st.label}
        </div>
        {isHome && (
          <span className="inline-block mt-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-brand bg-brand/9 px-1.5 py-[2px] rounded">
            Home
          </span>
        )}
        <div
          className="mt-1.5"
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 150ms' }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(venue.slug) }}
            className="text-[11px] font-semibold text-charcoal bg-transparent border border-charcoal/18 rounded-[7px] px-2.5 py-[3px] cursor-pointer"
          >
            Open →
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 pt-1.5 border-b border-charcoal/8 flex gap-2">
        {loading
          ? [0,1,2,3].map(i => (
              <div key={i} className="w-[22px] h-[22px] rounded-full bg-charcoal/6 animate-pulse" />
            ))
          : checks.map(c => <CheckDot key={c.label} done={c.done} label={c.label} />)
        }
      </div>

      <div className="flex">
        <StatCell
          value={loading ? '—' : (data?.clockedInCount ?? 0)}
          label="On shift"
          colorClass={data?.clockedInCount > 0 ? 'text-success' : 'text-charcoal'}
        />
        <StatCell
          value="—"
          label="Flags"
          colorClass="text-charcoal"
        />
        <StatCell
          value={loading ? '—' : (pendingCount > 0 ? pendingCount : '—')}
          label="Pending"
          colorClass={pendingCount > 0 ? 'text-warning' : 'text-charcoal/30'}
        />
        <StatCell
          value="—"
          label="Training"
          colorClass="text-charcoal/30"
          last
        />
      </div>
    </div>
  )
}

/* ── Summary strip cell ──────────────────────────────────────────────────────── */
const STRIP_CELLS = [
  { key: 'clear',     label: 'All clear',        numClass: 'text-success', barClass: 'bg-success' },
  { key: 'attention', label: 'Need attention',    numClass: 'text-danger',  barClass: 'bg-danger'  },
  { key: 'staff',     label: 'Staff on shift',    numClass: 'text-brand',   barClass: 'bg-brand'   },
  { key: 'pending',   label: 'Decisions pending', numClass: 'text-warning', barClass: 'bg-warning' },
]

function StripCell({ cell, value, isActive, onClick, loading, isLast }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'flex-1 p-[14px_18px_12px] text-left border-0 cursor-pointer relative transition-colors duration-100',
        isLast ? '' : 'border-r border-charcoal/8',
        isActive ? 'bg-charcoal/4' : hovered ? 'bg-charcoal/2' : 'bg-transparent',
      ].join(' ')}
    >
      {isActive && (
        <span className={`absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-sm ${cell.barClass}`} />
      )}
      <div className={`text-[28px] font-bold tracking-[-0.04em] tabular-nums leading-none ${cell.numClass}`}>
        {loading ? (
          <span className="inline-block w-10 h-7 rounded-md bg-charcoal/6" />
        ) : value}
      </div>
      <div className="text-[10px] font-semibold text-charcoal/40 mt-[3px] uppercase tracking-[0.04em]">
        {cell.label}
      </div>
    </button>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────────── */
export default function OverviewPage() {
  const { isManager } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()
  const { venues } = useAuth()

  const isMultiVenue = isManager && (venues?.length ?? 0) > 1
  if (!isMultiVenue) return <Navigate to={`/v/${venueSlug}/dashboard`} replace />

  const allVenues = venues ?? []
  const { results, aggregate, loading } = useAllVenueCompliance(allVenues)

  const [activeFilter, setActiveFilter] = useState(null)

  const stripValues = {
    clear:     aggregate.allClear,
    attention: aggregate.critical + aggregate.attention,
    staff:     aggregate.onShift,
    pending:   aggregate.decisions,
  }

  const filterLabels = {
    clear:     'All clear venues',
    attention: 'Venues needing attention',
    staff:     'Venues with staff on shift',
    pending:   'Venues with pending decisions',
  }

  function matchesFilter(result) {
    if (!activeFilter) return true
    if (activeFilter === 'clear')     return result.status === 'green'
    if (activeFilter === 'attention') return result.status === 'red' || result.status === 'amber'
    if (activeFilter === 'staff')     return (result.data?.clockedInCount ?? 0) > 0
    if (activeFilter === 'pending')   return (result.data?.pendingTimeOff?.length ?? 0) > 0
    return true
  }

  const handleCellClick = (key) => {
    setActiveFilter(prev => prev === key ? null : key)
  }

  const handleOpenVenue = (slug) => {
    window.location.replace(`/v/${slug}/dashboard`)
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const activeCell = STRIP_CELLS.find(c => c.key === activeFilter)

  return (
    <div className="max-w-[1280px] mx-auto py-8">

      <div className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-[-0.028em] text-charcoal m-0">
          {greeting}
        </h1>
        <p className="text-[13px] text-charcoal/45 mt-1">
          {format(new Date(), 'EEEE, d MMMM')} · {allVenues.length} venue{allVenues.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-charcoal/8 flex overflow-hidden mb-4">
        {STRIP_CELLS.map((cell, i) => (
          <StripCell
            key={cell.key}
            cell={cell}
            value={stripValues[cell.key]}
            isActive={activeFilter === cell.key}
            onClick={() => handleCellClick(cell.key)}
            loading={loading}
            isLast={i === STRIP_CELLS.length - 1}
          />
        ))}
      </div>

      {activeFilter && activeCell && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-charcoal/8 px-3.5 py-[9px] flex items-center gap-2.5 mb-4 animate-[fadeSlideIn_150ms_ease]">
          <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${activeCell.barClass}`} />
          <span className="text-xs font-semibold text-charcoal flex-1">
            {filterLabels[activeFilter]}
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className="text-[11px] font-semibold text-charcoal/40 bg-transparent border-0 cursor-pointer hover:text-charcoal transition-colors duration-100"
          >
            Clear ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {results.map(r => (
          <VenueCard
            key={r.venue.id}
            result={r}
            isHome={r.venue.slug === venueSlug}
            dimmed={activeFilter !== null && !matchesFilter(r)}
            onOpen={handleOpenVenue}
          />
        ))}
        {loading && results.length === 0 && allVenues.map(v => (
          <div key={v.id} className="h-[220px] bg-white dark:bg-[#1e1e1e] rounded-2xl border border-charcoal/8 animate-pulse" />
        ))}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
