import React, { useEffect, useState } from 'react'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { supabase } from '../../lib/supabase'
import ClockPanel from '../../components/ClockPanel'
import { useClockStatus } from '../../hooks/useClockEvents'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import RecentShifts from '../../components/shifts/RecentShifts'
import { format } from 'date-fns'

/* ── Live HH:MM:SS elapsed timer ────────────────────────────────────── */
function formatElapsed(ms) {
  if (!ms || ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function LiveElapsed({ clockInAt }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!clockInAt) return null
  return (
    <span className="font-mono text-xs tabular-nums text-charcoal/50">
      {formatElapsed(now - new Date(clockInAt).getTime())}
    </span>
  )
}

/* ── Staff row in manager view ────────────────────────────────────── */
function StaffClockRow({ staffMember }) {
  const { status, clockInAt, loading } = useClockStatus(staffMember.id)
  const STATUS = {
    clocked_in:  { label: 'Clocked In',  dot: 'bg-success',     text: 'text-success' },
    on_break:    { label: 'On Break',     dot: 'bg-warning',     text: 'text-warning' },
    clocked_out: { label: 'Not in',       dot: 'bg-charcoal/25', text: 'text-charcoal/40' },
  }
  const cfg = STATUS[status ?? 'clocked_out']
  return (
    <div className="flex items-center justify-between py-3 border-t border-charcoal/6 first:border-0">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div>
          <p className="text-sm font-medium text-charcoal">{staffMember.name}</p>
          {staffMember.role && (
            <p className="text-[11px] text-charcoal/35 mt-0.5">{staffMember.role}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {loading ? (
          <span className="text-xs text-charcoal/30">…</span>
        ) : (
          <>
            <span className={`text-[11px] tracking-widest uppercase font-medium ${cfg.text}`}>
              {cfg.label}
            </span>
            {status !== 'clocked_out' && clockInAt && <LiveElapsed clockInAt={clockInAt} />}
          </>
        )}
      </div>
    </div>
  )
}

function ManagerOwnClock({ venueId }) {
  const { session } = useSession()
  if (!session?.staffId) return <p className="text-sm text-charcoal/35 italic">No staff session.</p>
  return <ClockPanel staffId={session.staffId} hasShift />
}

/* ── Manager view ────────────────────────────────────────────────── */
function ManagerView({ venueId }) {
  const { session } = useSession()
  const [staff, setStaff]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) return
    supabase
      .from('staff')
      .select('id, name, role')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setStaff(data ?? []); setLoading(false) })
  }, [venueId])

  return (
    <div className="flex flex-col gap-6">
      {/* Manager's own clock */}
      <div className="bg-white rounded-xl p-5">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">My Clock</p>
        <ManagerOwnClock venueId={venueId} />
      </div>

      {/* Manager's own recent shifts — editable (isManagerEdit so no notification fires) */}
      {session?.staffId && (
        <RecentShifts staffId={session.staffId} isManagerEdit={true} />
      )}

      {/* Team status */}
      <div className="bg-white rounded-xl p-5">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Team Status</p>
        {loading ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-charcoal/35 italic">No active staff found.</p>
        ) : (
          <div className="flex flex-col">
            {staff.map((s) => <StaffClockRow key={s.id} staffMember={s} />)}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Staff view ──────────────────────────────────────────────────── */
function StaffView({ staffId, staffName }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl p-6">
        {staffName && (
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">
            Hi, {staffName}
          </p>
        )}
        <p className="text-xs text-charcoal/40 mb-5">
          {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
        <ClockPanel staffId={staffId} hasShift />
      </div>

      <RecentShifts staffId={staffId} isManagerEdit={false} />
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function ClockInPage() {
  const { session, isManager } = useSession()
  const { venueId } = useVenue()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl text-brand">Clock In / Out</h1>
      {isManager
        ? <ManagerView venueId={venueId} />
        : <StaffView staffId={session?.staffId} staffName={session?.staffName} />
      }
    </div>
  )
}
