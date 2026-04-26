import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueComplianceData } from '../../hooks/useVenueComplianceData'
import { supabase } from '../../lib/supabase'

/* ── Check pill ──────────────────────────────────────────────────────────── */
function CheckPill({ label, done }) {
  return (
    <span className={[
      'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
      done
        ? 'bg-success/8 text-success'
        : 'bg-warning/8 text-warning',
    ].join(' ')}>
      {done ? <svg className="w-3 h-3 shrink-0 inline" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> : <span className="opacity-40">—</span>} {label}
    </span>
  )
}

/* ── Status dot ──────────────────────────────────────────────────────────── */
function StatusDot({ colour }) {
  const cls = {
    green: 'bg-success',
    amber: 'bg-warning',
    red:   'bg-danger',
  }[colour] ?? 'bg-charcoal/20'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cls}`} />
}

function venueStatus(data) {
  if (!data) return 'gray'
  if (!data.fridgeAM || !data.fridgePM || !data.hotHoldingAM || !data.hotHoldingPM) return 'red'
  if (data.cookingCount === 0 || data.pendingTimeOff.length > 0) return 'amber'
  return 'green'
}

/* ── Venue card ──────────────────────────────────────────────────────────── */
function VenueCard({ venue, isHome }) {
  const { session } = useSession()
  const { data, loading } = useVenueComplianceData(venue.id)
  const [approving, setApproving] = useState({}) // { [id]: 'approving'|'rejecting' }

  const handleTimeOff = async (id, action) => {
    setApproving(a => ({ ...a, [id]: action }))
    const { error } = await supabase.from('time_off_requests').update({
      status:       action === 'approve' ? 'approved' : 'rejected',
      reviewed_by:  session.staffId,
      reviewed_at:  new Date().toISOString(),
    }).eq('id', id)
    setApproving(a => ({ ...a, [id]: null }))
    return error ? 'error' : 'ok'
  }

  const colour = loading ? 'gray' : venueStatus(data)

  return (
    <div className="bg-white rounded-2xl border border-charcoal/8 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-charcoal/6">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusDot colour={colour} />
          <div className="min-w-0">
            <p className="font-semibold text-charcoal text-sm truncate">{venue.name}</p>
            <p className="text-[11px] text-charcoal/35 mt-0.5">
              pelikn.app/v/{venue.slug}
              {isHome && <span className="ml-2 px-1.5 py-0.5 rounded bg-brand/8 text-brand text-[9px] tracking-widest uppercase font-semibold">Home</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => { window.location.replace(`/v/${venue.slug}/dashboard`) }}
          className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors whitespace-nowrap shrink-0"
        >
          Open →
        </button>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 flex flex-col gap-4">

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 rounded-full border-2 border-charcoal/12 border-t-brand animate-spin" />
          </div>
        ) : (
          <>
            {/* Today's checks */}
            <div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/35 font-semibold mb-2">
                Today's Checks
              </p>
              <div className="flex flex-wrap gap-1.5">
                <CheckPill label="Fridge AM"    done={data.fridgeAM} />
                <CheckPill label="Fridge PM"    done={data.fridgePM} />
                <CheckPill label="Cooking"      done={data.cookingCount > 0} />
                <CheckPill label="Hot Hold AM"  done={data.hotHoldingAM} />
                <CheckPill label="Hot Hold PM"  done={data.hotHoldingPM} />
              </div>
            </div>

            {/* Team snapshot */}
            <div className="flex items-center gap-2 text-sm text-charcoal/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-charcoal/30">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
              {data.clockedInCount > 0
                ? <span><strong className="text-charcoal">{data.clockedInCount}</strong> staff clocked in</span>
                : <span className="text-charcoal/35">Nobody clocked in</span>
              }
            </div>

            {/* Pending time-off */}
            {data.pendingTimeOff.length > 0 && (
              <div>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/35 font-semibold mb-2">
                  Time Off — {data.pendingTimeOff.length} pending
                </p>
                <div className="flex flex-col gap-2">
                  {data.pendingTimeOff.map(req => (
                    <TimeOffRow
                      key={req.id}
                      req={req}
                      busy={!!approving[req.id]}
                      action={approving[req.id]}
                      onAction={handleTimeOff}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Time-off row ────────────────────────────────────────────────────────── */
function TimeOffRow({ req, busy, action, onAction }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const handleAction = async (type) => {
    const result = await onAction(req.id, type)
    if (result !== 'error') setDismissed(true)
  }

  const fmtDate = (d) => format(parseISO(d), 'd MMM')
  const dateRange = req.start_date === req.end_date
    ? fmtDate(req.start_date)
    : `${fmtDate(req.start_date)} – ${fmtDate(req.end_date)}`

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3 bg-white rounded-2xl border border-charcoal/6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-charcoal truncate">{req.staff?.name ?? 'Unknown'}</p>
        <p className="text-[11px] text-charcoal/45 mt-0.5">{dateRange}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          disabled={busy}
          onClick={() => handleAction('approve')}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-success text-white hover:bg-success/90 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {busy && action === 'approve' ? '…' : 'Approve'}
        </button>
        <button
          disabled={busy}
          onClick={() => handleAction('reject')}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-charcoal/15 text-charcoal/60 hover:border-charcoal/30 hover:text-charcoal disabled:opacity-40 transition-colors"
        >
          {busy && action === 'reject' ? '…' : 'Decline'}
        </button>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function OverviewPage() {
  const { session, linkedVenues } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()

  const homeVenue = { id: venueId, slug: venueSlug, name: venueName }
  const allVenues = [homeVenue, ...linkedVenues]

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">My Venues</h1>
          <p className="text-sm text-charcoal/45 mt-1">{allVenues.length} venue{allVenues.length !== 1 ? 's' : ''} · today's compliance snapshot</p>
        </div>
        <Link
          to={`/v/${venueSlug}/dashboard`}
          className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
        >
          ← Back to {venueName || 'venue'}
        </Link>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-charcoal/45">
        <span className="flex items-center gap-1.5"><StatusDot colour="green" /> All checks done</span>
        <span className="flex items-center gap-1.5"><StatusDot colour="amber" /> Attention needed</span>
        <span className="flex items-center gap-1.5"><StatusDot colour="red"   /> Critical check missing</span>
      </div>

      {/* Venue grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {allVenues.map((v, i) => (
          <VenueCard key={v.id} venue={v} isHome={i === 0} />
        ))}
      </div>
    </div>
  )
}
