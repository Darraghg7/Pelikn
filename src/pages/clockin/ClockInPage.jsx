import React, { useEffect, useState } from 'react'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { supabase } from '../../lib/supabase'
import { offlineRpc } from '../../lib/offlineSupabase'
import ClockPanel from '../../components/ClockPanel'
import { useClockStatus } from '../../hooks/useClockEvents'
import { useClockSessions } from '../../hooks/useClockSessions'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { format, isToday, isYesterday, subDays } from 'date-fns'

function formatElapsed(ms) {
  if (!ms || ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/* ── Friendly date label ─────────────────────────────────────────── */
function sessionDateLabel(date) {
  if (isToday(date))     return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, d MMM')
}

/* ── Inline edit form for a single session ───────────────────────── */
function EditSessionForm({ session, onSave, onCancel, isManagerEdit = false }) {
  const toast = useToast()
  const [clockIn,  setClockIn]  = useState(format(session.clockInAt,  'HH:mm'))
  const [clockOut, setClockOut] = useState(session.clockOutAt ? format(session.clockOutAt, 'HH:mm') : '')
  const [breakMin, setBreakMin] = useState(String(session.breakMinutes))
  const [saving,   setSaving]   = useState(false)

  const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90]

  const handleSave = async () => {
    // Build timestamptz values from the HH:mm inputs using the session date
    const base = session.clockInAt

    const parseTime = (timeStr, referenceDate) => {
      const [h, m] = timeStr.split(':').map(Number)
      const d = new Date(referenceDate)
      d.setHours(h, m, 0, 0)
      return d
    }

    const newClockIn  = parseTime(clockIn, base)
    const newClockOut = clockOut ? parseTime(clockOut, base) : null

    // Basic validation
    if (newClockOut && newClockOut <= newClockIn) {
      toast('Clock out must be after clock in', 'error')
      return
    }

    setSaving(true)
    const { error } = await offlineRpc('edit_clock_session', {
      p_clock_in_id:    session.clockInId,
      p_clock_in_time:  newClockIn.toISOString(),
      p_clock_out_id:   session.clockOutId ?? null,
      p_clock_out_time: newClockOut?.toISOString() ?? null,
      p_break_minutes:  parseInt(breakMin, 10) || 0,
    })
    setSaving(false)

    if (error) { toast(error.message ?? 'Failed to save', 'error'); return }

    // If a staff member (not a manager) edited their hours, log it so the manager is notified
    if (!isManagerEdit) {
      supabase.rpc('log_hour_edit', { p_clock_in_id: session.clockInId }).catch(() => {})
    }

    toast('Shift updated')
    onSave()
  }

  return (
    <div className="mt-3 pt-3 border-t border-charcoal/8 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Clock In */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Clock In</label>
          <input
            type="time"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {/* Clock Out */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Clock Out</label>
          <input
            type="time"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            placeholder="--:--"
            className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>

      {/* Break */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Break</label>
        <select
          value={breakMin}
          onChange={(e) => setBreakMin(e.target.value)}
          className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          {BREAK_OPTIONS.map((m) => (
            <option key={m} value={String(m)}>
              {m === 0 ? 'No break' : `${m} min`}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-charcoal/60 bg-charcoal/6 hover:bg-charcoal/10 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ── Single session row ──────────────────────────────────────────── */
function SessionRow({ session, onReload, isManagerEdit = false }) {
  const [editing, setEditing] = useState(false)

  const durationMs = session.clockOutAt
    ? session.clockOutAt - session.clockInAt - session.breakMinutes * 60000
    : null

  const handleSave = () => {
    setEditing(false)
    onReload()
  }

  return (
    <div className="py-3 border-t border-charcoal/6 first:border-0">
      {/* Summary row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal">
            {sessionDateLabel(session.date)}
          </p>
          <p className="text-xs text-charcoal/40 mt-0.5">
            {format(session.clockInAt, 'HH:mm')}
            {' → '}
            {session.clockOutAt ? format(session.clockOutAt, 'HH:mm') : <span className="text-warning">active</span>}
            {session.breakMinutes > 0 && (
              <span className="ml-1.5 text-charcoal/30">· {session.breakMinutes}m break</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {durationMs !== null && (
            <span className="font-mono text-sm text-charcoal/60 tabular-nums">
              {formatElapsed(durationMs)}
            </span>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs font-medium text-brand/70 hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/8"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <EditSessionForm
          session={session}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          isManagerEdit={isManagerEdit}
        />
      )}
    </div>
  )
}

/* ── Add shift manually form ─────────────────────────────────────── */
function AddShiftForm({ staffId, onSave, onCancel }) {
  const toast    = useToast()
  const { venueId } = useVenue()
  const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90]

  // Build last-7-days date options
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), i)
    return { value: format(d, 'yyyy-MM-dd'), label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : format(d, 'EEE, d MMM') }
  })

  const [date,     setDate]     = useState(dateOptions[0].value)
  const [clockIn,  setClockIn]  = useState('09:00')
  const [clockOut, setClockOut] = useState('17:00')
  const [breakMin, setBreakMin] = useState('0')
  const [saving,   setSaving]   = useState(false)

  const handleAdd = async () => {
    const newClockIn  = new Date(`${date}T${clockIn}:00`)
    const newClockOut = new Date(`${date}T${clockOut}:00`)
    if (newClockOut <= newClockIn) { toast('Clock out must be after clock in', 'error'); return }

    setSaving(true)
    // Insert clock_in event then use edit_clock_session to add clock_out + break
    const { data: ciData, error: ciErr } = await supabase
      .from('clock_events')
      .insert({ staff_id: staffId, venue_id: venueId, event_type: 'clock_in', occurred_at: newClockIn.toISOString() })
      .select('id')
      .single()
    if (ciErr) { toast(ciErr.message ?? 'Failed to save', 'error'); setSaving(false); return }

    const { error: editErr } = await offlineRpc('edit_clock_session', {
      p_clock_in_id:    ciData.id,
      p_clock_in_time:  newClockIn.toISOString(),
      p_clock_out_id:   null,
      p_clock_out_time: newClockOut.toISOString(),
      p_break_minutes:  parseInt(breakMin, 10) || 0,
    })
    setSaving(false)
    if (editErr) { toast(editErr.message ?? 'Failed to save', 'error'); return }
    toast('Shift added')
    onSave()
  }

  return (
    <div className="mt-3 pt-3 border-t border-charcoal/8 flex flex-col gap-3">
      {/* Date */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Date</label>
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          {dateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Clock In</label>
          <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)}
            className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Clock Out</label>
          <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)}
            className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Break</label>
        <select value={breakMin} onChange={(e) => setBreakMin(e.target.value)}
          className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30">
          {BREAK_OPTIONS.map((m) => <option key={m} value={String(m)}>{m === 0 ? 'No break' : `${m} min`}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-charcoal/60 bg-charcoal/6 hover:bg-charcoal/10 transition-colors disabled:opacity-40">
          Cancel
        </button>
        <button onClick={handleAdd} disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Add Shift'}
        </button>
      </div>
    </div>
  )
}

/* ── Recent shifts list ──────────────────────────────────────────── */
function RecentShifts({ staffId, isManagerEdit = false }) {
  const { sessions, loading, reload } = useClockSessions(staffId)
  const [adding, setAdding] = useState(false)

  return (
    <div className="bg-white rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Recent Shifts</p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-brand/70 hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/8"
          >
            + Add shift
          </button>
        )}
      </div>
      <p className="text-xs text-charcoal/30 mb-3">Tap Edit to correct a clock-in, clock-out or break time.</p>

      {adding && (
        <AddShiftForm
          staffId={staffId}
          onSave={() => { setAdding(false); reload() }}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-4"><LoadingSpinner /></div>
      ) : sessions.length === 0 && !adding ? (
        <p className="text-sm text-charcoal/35 italic py-2">No shifts recorded in the last 7 days.</p>
      ) : (
        <div className="flex flex-col">
          {sessions.map((s) => (
            <SessionRow key={s.clockInId} session={s} onReload={reload} isManagerEdit={isManagerEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Live elapsed timer for the manager's "who's in" view ─────────── */
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
            {status !== 'clocked_out' && clockInAt && (
              <LiveElapsed clockInAt={clockInAt} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Manager view: who is currently clocked in ───────────────────── */
function ManagerView({ venueId }) {
  const { session } = useSession()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) return
    supabase
      .from('staff')
      .select('id, name, role')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setStaff(data ?? [])
        setLoading(false)
      })
  }, [venueId])

  return (
    <div className="flex flex-col gap-6">
      {/* Manager's own clock */}
      <div className="bg-white rounded-xl p-5">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">My Clock</p>
        <ManagerOwnClock venueId={venueId} />
      </div>

      {/* Manager's own recent shifts — editable */}
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
            {staff.map((s) => (
              <StaffClockRow key={s.id} staffMember={s} />
            ))}
          </div>
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

/* ── Staff view: big clock in / out + recent shifts ──────────────── */
function StaffView({ staffId, staffName }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl p-6">
        {staffName && (
          <p className="text-[11px] tracking-widests uppercase text-charcoal/40 mb-1">
            Hi, {staffName}
          </p>
        )}
        <p className="text-xs text-charcoal/40 mb-5">
          {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
        <ClockPanel staffId={staffId} hasShift />
      </div>

      <RecentShifts staffId={staffId} />
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
      {isManager ? (
        <ManagerView venueId={venueId} />
      ) : (
        <StaffView staffId={session?.staffId} staffName={session?.staffName} />
      )}
    </div>
  )
}
