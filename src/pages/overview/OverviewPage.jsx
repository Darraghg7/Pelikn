import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAllVenueCompliance } from '../../hooks/useAllVenueCompliance'
import { supabase } from '../../lib/supabase'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const STATUS_COLOUR = { green: '#2d7a4f', amber: '#b45309', red: '#c0392b', gray: '#9ca3af' }

function StatusDot({ status }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: STATUS_COLOUR[status] ?? STATUS_COLOUR.gray }}
    />
  )
}

function missingChecks(data) {
  if (!data) return []
  const missing = []
  if (!data.fridgeAM)     missing.push('Fridge AM')
  if (!data.fridgePM)     missing.push('Fridge PM')
  if (!data.hotHoldingAM) missing.push('Hot Hold AM')
  if (!data.hotHoldingPM) missing.push('Hot Hold PM')
  return missing
}

/* ── Metric tile ─────────────────────────────────────────────────────────── */
function MetricTile({ value, label, colour, loading }) {
  const colourMap = {
    green:  'text-success',
    amber:  'text-warning',
    red:    'text-danger',
    brand:  'text-brand',
    muted:  'text-charcoal/50',
  }
  return (
    <div className="bg-white rounded-2xl border border-charcoal/8 px-5 py-4 flex flex-col gap-1">
      <span className={`text-3xl font-bold tabular-nums ${colourMap[colour] ?? 'text-charcoal'}`}>
        {loading ? <span className="inline-block w-8 h-7 rounded bg-charcoal/6 animate-pulse" /> : value}
      </span>
      <span className="text-xs text-charcoal/45 font-medium">{label}</span>
    </div>
  )
}

/* ── Section heading ─────────────────────────────────────────────────────── */
function SectionHeading({ label, count, colour }) {
  const dot = { red: 'bg-danger', amber: 'bg-warning' }[colour]
  return (
    <div className="flex items-center gap-2.5">
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      <span className="text-[11px] tracking-widest uppercase font-semibold text-charcoal/50">
        {label}
      </span>
      <span className="text-[11px] text-charcoal/30 font-medium">{count}</span>
    </div>
  )
}

/* ── Time-off row (inline approve/decline) ───────────────────────────────── */
function TimeOffRow({ req, venueId }) {
  const { session } = useSession()
  const [state, setState] = useState('idle') // idle | approving | rejecting | done

  const handle = async (action) => {
    setState(action === 'approve' ? 'approving' : 'rejecting')
    await supabase.from('time_off_requests').update({
      status:      action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: session.staffId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.id)
    setState('done')
  }

  if (state === 'done') return null

  const fmtDate = d => format(parseISO(d), 'd MMM')
  const range = req.start_date === req.end_date
    ? fmtDate(req.start_date)
    : `${fmtDate(req.start_date)} – ${fmtDate(req.end_date)}`

  const busy = state === 'approving' || state === 'rejecting'

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-charcoal/2 border border-charcoal/6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-charcoal truncate">{req.staff?.name ?? 'Staff'}</p>
        <p className="text-[11px] text-charcoal/40">{range}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          disabled={busy}
          onClick={() => handle('approve')}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-success text-white hover:bg-success/90 disabled:opacity-40 transition-colors"
        >
          {state === 'approving' ? '…' : 'Approve'}
        </button>
        <button
          disabled={busy}
          onClick={() => handle('reject')}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-charcoal/15 text-charcoal/60 hover:border-charcoal/30 hover:text-charcoal disabled:opacity-40 transition-colors"
        >
          {state === 'rejecting' ? '…' : 'Decline'}
        </button>
      </div>
    </div>
  )
}

/* ── Alert card (critical / attention) ──────────────────────────────────── */
function AlertCard({ result, type }) {
  const { venue, data, status } = result
  const borderColour = type === 'critical' ? 'border-danger/20' : 'border-warning/20'
  const bgColour     = type === 'critical' ? 'bg-danger/2'      : 'bg-warning/2'
  const missing      = missingChecks(data)

  return (
    <div className={`rounded-2xl border ${borderColour} ${bgColour} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-charcoal/6">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusDot status={status} />
          <p className="font-semibold text-sm text-charcoal truncate">{venue.name}</p>
        </div>
        <button
          onClick={() => window.location.replace(`/v/${venue.slug}/dashboard`)}
          className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors whitespace-nowrap shrink-0"
        >
          Open →
        </button>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2.5">
        {missing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {missing.map(m => (
              <span key={m} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger/8 text-danger">
                <span className="opacity-60">✕</span> {m}
              </span>
            ))}
          </div>
        )}

        {data?.pendingTimeOff?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/35 font-semibold">
              Time off · {data.pendingTimeOff.length} pending
            </p>
            {data.pendingTimeOff.map(req => (
              <TimeOffRow key={req.id} req={req} venueId={venue.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Compact venue row (table) ───────────────────────────────────────────── */
function VenueRow({ result, isHome }) {
  const { venue, data, status, loading } = result

  const checks = data
    ? [
        { label: 'Fridge AM', done: data.fridgeAM },
        { label: 'Fridge PM', done: data.fridgePM },
        { label: 'Hot Hold AM', done: data.hotHoldingAM },
        { label: 'Hot Hold PM', done: data.hotHoldingPM },
      ]
    : []

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-charcoal/2 transition-colors group">
      {/* Name */}
      <div className="flex items-center gap-2.5 w-44 shrink-0 min-w-0">
        <StatusDot status={loading ? 'gray' : status} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal truncate">{venue.name}</p>
          {isHome && (
            <span className="text-[9px] tracking-widest uppercase text-brand/60 font-semibold">Home</span>
          )}
        </div>
      </div>

      {/* Check dots */}
      <div className="flex items-center gap-1.5 flex-1">
        {loading ? (
          <div className="flex gap-1.5">
            {[0,1,2,3].map(i => <span key={i} className="w-5 h-5 rounded-full bg-charcoal/6 animate-pulse" />)}
          </div>
        ) : (
          checks.map(c => (
            <span
              key={c.label}
              title={c.label}
              className={[
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                c.done ? 'bg-success/12 text-success' : 'bg-danger/8 text-danger',
              ].join(' ')}
            >
              {c.done ? '✓' : '✕'}
            </span>
          ))
        )}
      </div>

      {/* On shift */}
      <div className="w-20 shrink-0 text-center">
        {loading
          ? <span className="inline-block w-6 h-4 bg-charcoal/6 animate-pulse rounded" />
          : <span className="text-sm text-charcoal/70">{data?.clockedInCount ?? 0}</span>
        }
      </div>

      {/* Pending */}
      <div className="w-20 shrink-0 text-center">
        {loading
          ? <span className="inline-block w-6 h-4 bg-charcoal/6 animate-pulse rounded" />
          : data?.pendingTimeOff?.length > 0
            ? <span className="text-sm font-semibold text-warning">{data.pendingTimeOff.length}</span>
            : <span className="text-sm text-charcoal/25">—</span>
        }
      </div>

      {/* Open */}
      <button
        onClick={() => window.location.replace(`/v/${venue.slug}/dashboard`)}
        className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/12 text-charcoal/50 hover:text-charcoal hover:border-charcoal/30 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
      >
        Open →
      </button>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function OverviewPage() {
  const { linkedVenues } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()

  const homeVenue = { id: venueId, slug: venueSlug, name: venueName }
  const allVenues = [homeVenue, ...linkedVenues]

  const { results, aggregate, loading } = useAllVenueCompliance(allVenues)

  const critical  = results.filter(r => r.status === 'red')
  const attention = results.filter(r => r.status === 'amber')

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">My Venues</h1>
          <p className="text-sm text-charcoal/45 mt-0.5">
            {format(new Date(), 'EEEE d MMMM')} · {allVenues.length} venue{allVenues.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to={`/v/${venueSlug}/dashboard`}
          className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20 whitespace-nowrap shrink-0"
        >
          ← {venueName || 'Dashboard'}
        </Link>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile value={aggregate.allClear}  label="All clear"        colour="green" loading={loading} />
        <MetricTile value={aggregate.critical + aggregate.attention} label="Need attention" colour={aggregate.critical > 0 ? 'red' : aggregate.attention > 0 ? 'amber' : 'muted'} loading={loading} />
        <MetricTile value={aggregate.onShift}   label="Staff on shift"   colour="brand" loading={loading} />
        <MetricTile value={aggregate.decisions} label="Decisions pending" colour={aggregate.decisions > 0 ? 'amber' : 'muted'} loading={loading} />
      </div>

      {/* Critical venues */}
      {critical.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeading label="Critical — checks missing" count={critical.length} colour="red" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {critical.map(r => (
              <AlertCard key={r.venue.id} result={r} type="critical" />
            ))}
          </div>
        </div>
      )}

      {/* Attention venues */}
      {attention.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeading label="Attention needed" count={attention.length} colour="amber" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attention.map(r => (
              <AlertCard key={r.venue.id} result={r} type="attention" />
            ))}
          </div>
        </div>
      )}

      {/* All venues table */}
      <div className="flex flex-col gap-2">
        <SectionHeading label="All venues" count={results.length} />
        <div className="bg-white rounded-2xl border border-charcoal/8 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 py-2 px-4 border-b border-charcoal/6">
            <span className="text-[10px] tracking-widest uppercase text-charcoal/30 font-semibold w-44 shrink-0">Venue</span>
            <div className="flex items-center gap-1.5 flex-1">
              {['F·AM', 'F·PM', 'H·AM', 'H·PM'].map(l => (
                <span key={l} className="text-[10px] tracking-widest uppercase text-charcoal/30 font-semibold w-5 text-center">{l}</span>
              ))}
            </div>
            <span className="text-[10px] tracking-widest uppercase text-charcoal/30 font-semibold w-20 shrink-0 text-center">On shift</span>
            <span className="text-[10px] tracking-widest uppercase text-charcoal/30 font-semibold w-20 shrink-0 text-center">Leave</span>
            <span className="w-[68px] shrink-0" />
          </div>

          {results.map((r, i) => (
            <div key={r.venue.id} className={i < results.length - 1 ? 'border-b border-charcoal/4' : ''}>
              <VenueRow result={r} isHome={i === 0} />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
