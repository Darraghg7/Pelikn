import React, { useState } from 'react'
import { format } from 'date-fns'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAuth } from '../../contexts/AuthContext'
import { useAllVenueCompliance } from '../../hooks/useAllVenueCompliance'
import { Navigate } from 'react-router-dom'

/* ── Status helpers ──────────────────────────────────────────────────────────── */
const STATUS = {
  green:  { color: '#276640', bg: '#276640', label: 'All clear' },
  amber:  { color: '#e08a4a', bg: '#e08a4a', label: 'Needs attention' },
  red:    { color: '#d44d3a', bg: '#d44d3a', label: 'Checks missing' },
  gray:   { color: '#9ca3af', bg: '#9ca3af', label: 'Loading…' },
}

function statusFor(result) {
  return STATUS[result.status] ?? STATUS.gray
}

/* ── Check indicator (22×22 circle) ─────────────────────────────────────────── */
function CheckDot({ done, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        background: done ? 'rgba(39,102,64,0.12)' : 'rgba(212,77,58,0.10)',
        color: done ? '#276640' : '#d44d3a',
      }}>
        {done ? '✓' : '✕'}
      </div>
      <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(14,20,17,0.40)', textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </span>
    </div>
  )
}

/* ── Footer stat cell ────────────────────────────────────────────────────────── */
function StatCell({ value, label, color, last }) {
  return (
    <div style={{
      flex: 1, paddingLeft: 14, paddingTop: 10, paddingBottom: 10,
      borderRight: last ? 'none' : '1px solid rgba(14,20,17,0.08)',
    }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: color ?? '#0E1411', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(14,20,17,0.40)', marginTop: 1 }}>
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
      style={{
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid rgba(14,20,17,0.08)',
        overflow: 'hidden',
        cursor: dimmed ? 'default' : 'pointer',
        opacity: dimmed ? 0.20 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transform: hovered && !dimmed ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered && !dimmed ? '0 8px 24px rgba(0,0,0,0.10)' : 'none',
        transition: 'transform 150ms, box-shadow 150ms, opacity 150ms',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* 3px coloured top bar */}
      <div style={{ height: 3, background: st.bg, borderRadius: '16px 16px 0 0' }} />

      {/* Top section */}
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0E1411', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {venue.name}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: st.color, marginTop: 2 }}>
          {loading ? 'Loading…' : st.label}
        </div>
        {isHome && (
          <span style={{
            display: 'inline-block', marginTop: 4,
            fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#2D4F45', background: 'rgba(45,79,69,0.09)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            Home
          </span>
        )}
        <div style={{
          marginTop: isHome ? 6 : 8,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(venue.slug) }}
            style={{
              fontSize: 11, fontWeight: 600,
              color: '#0E1411', background: 'none',
              border: '1px solid rgba(14,20,17,0.18)',
              borderRadius: 7, padding: '3px 10px',
              cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            Open →
          </button>
        </div>
      </div>

      {/* Checks row */}
      <div style={{
        padding: '6px 16px 12px',
        borderBottom: '1px solid rgba(14,20,17,0.08)',
        display: 'flex', gap: 8,
      }}>
        {loading
          ? [0,1,2,3].map(i => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(14,20,17,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))
          : checks.map(c => <CheckDot key={c.label} done={c.done} label={c.label} />)
        }
      </div>

      {/* Footer stats */}
      <div style={{ display: 'flex' }}>
        <StatCell
          value={loading ? '—' : (data?.clockedInCount ?? 0)}
          label="On shift"
          color={data?.clockedInCount > 0 ? '#276640' : '#0E1411'}
        />
        <StatCell
          value="—"
          label="Flags"
          color="#0E1411"
        />
        <StatCell
          value={loading ? '—' : (pendingCount > 0 ? pendingCount : '—')}
          label="Pending"
          color={pendingCount > 0 ? '#e08a4a' : 'rgba(14,20,17,0.30)'}
        />
        <StatCell
          value="—"
          label="Training"
          color="rgba(14,20,17,0.30)"
          last
        />
      </div>
    </div>
  )
}

/* ── Summary strip cell ──────────────────────────────────────────────────────── */
const STRIP_CELLS = [
  { key: 'clear',     label: 'All clear',        color: '#276640', borderColor: '#276640' },
  { key: 'attention', label: 'Need attention',    color: '#d44d3a', borderColor: '#d44d3a' },
  { key: 'staff',     label: 'Staff on shift',    color: '#2D4F45', borderColor: '#2D4F45' },
  { key: 'pending',   label: 'Decisions pending', color: '#e08a4a', borderColor: '#e08a4a' },
]

function StripCell({ cell, value, isActive, onClick, loading, isLast }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, padding: '14px 18px 12px', textAlign: 'left',
        background: isActive ? 'rgba(14,20,17,0.04)' : hovered ? 'rgba(14,20,17,0.02)' : 'transparent',
        border: 'none', cursor: 'pointer',
        borderRight: isLast ? 'none' : '1px solid rgba(14,20,17,0.08)',
        position: 'relative',
        transition: 'background .1s',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}
    >
      {/* Active bottom border */}
      {isActive && (
        <span style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 2.5, background: cell.borderColor, borderRadius: '2px 2px 0 0',
        }} />
      )}
      <div style={{
        fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em',
        fontVariantNumeric: 'tabular-nums',
        color: cell.color,
        lineHeight: 1,
      }}>
        {loading ? (
          <span style={{ display: 'inline-block', width: 40, height: 28, borderRadius: 6, background: 'rgba(14,20,17,0.06)' }} />
        ) : value}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'rgba(14,20,17,0.40)', marginTop: 3,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
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

  const [activeFilter, setActiveFilter] = useState(null) // 'clear' | 'attention' | 'staff' | 'pending' | null

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
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 0' }}>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0E1411', letterSpacing: '-0.02em', margin: 0 }}>
          {greeting}
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(14,20,17,0.45)', marginTop: 4 }}>
          {format(new Date(), 'EEEE, d MMMM')} · {allVenues.length} venue{allVenues.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary strip */}
      <div style={{
        background: '#ffffff', borderRadius: 16,
        border: '1px solid rgba(14,20,17,0.08)',
        display: 'flex', overflow: 'hidden',
        marginBottom: 16,
      }}>
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

      {/* Filter bar */}
      {activeFilter && activeCell && (
        <div style={{
          background: '#ffffff', borderRadius: 12,
          border: '1px solid rgba(14,20,17,0.08)',
          padding: '9px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 16,
          animation: 'fadeSlideIn 150ms ease',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeCell.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0E1411', flex: 1 }}>
            {filterLabels[activeFilter]}
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            style={{
              fontSize: 11, fontWeight: 600, color: 'rgba(14,20,17,0.40)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              transition: 'color .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#0E1411'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(14,20,17,0.40)'}
          >
            Clear ✕
          </button>
        </div>
      )}

      {/* Venue card grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
      }}>
        {results.map(r => (
          <VenueCard
            key={r.venue.id}
            result={r}
            isHome={r.venue.slug === venueSlug}
            dimmed={activeFilter !== null && !matchesFilter(r)}
            onOpen={handleOpenVenue}
          />
        ))}
        {/* Loading placeholders */}
        {loading && results.length === 0 && allVenues.map(v => (
          <div key={v.id} style={{
            height: 220, background: '#ffffff', borderRadius: 16,
            border: '1px solid rgba(14,20,17,0.08)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
