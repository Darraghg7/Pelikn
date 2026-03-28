/**
 * RecentShifts — shared component used on both StaffDashboardPage and
 * ClockInPage. Shows the last 7 days of sessions with inline editing and
 * a manual "Add shift" form for missed punches.
 */
import React, { useState } from 'react'
import { format, isToday, isYesterday, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { offlineRpc } from '../../lib/offlineSupabase'
import { useVenue } from '../../contexts/VenueContext'
import { useClockSessions } from '../../hooks/useClockSessions'
import { useToast } from '../ui/Toast'
import LoadingSpinner from '../ui/LoadingSpinner'

/* ── Helpers ─────────────────────────────────────────────────────────── */
function sessionDateLabel(date) {
  if (isToday(date))     return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, d MMM')
}

function formatElapsed(ms) {
  if (!ms || ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}h ${pad(m)}m`
}

const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90]

/* ── Inline edit form ────────────────────────────────────────────────── */
function EditSessionForm({ session, onSave, onCancel, isManagerEdit = false }) {
  const toast = useToast()
  const [clockIn,  setClockIn]  = useState(format(session.clockInAt,  'HH:mm'))
  const [clockOut, setClockOut] = useState(session.clockOutAt ? format(session.clockOutAt, 'HH:mm') : '')
  const [breakMin, setBreakMin] = useState(String(session.breakMinutes))
  const [saving,   setSaving]   = useState(false)

  const handleSave = async () => {
    const parseTime = (timeStr, referenceDate) => {
      const [h, m] = timeStr.split(':').map(Number)
      const d = new Date(referenceDate)
      d.setHours(h, m, 0, 0)
      return d
    }
    const newClockIn  = parseTime(clockIn, session.clockInAt)
    const newClockOut = clockOut ? parseTime(clockOut, session.clockInAt) : null

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

    // Log it so manager is notified if a staff member (non-manager) edits
    if (!isManagerEdit) {
      supabase.rpc('log_hour_edit', { p_clock_in_id: session.clockInId }).catch(() => {})
    }

    toast('Shift updated')
    onSave()
  }

  return (
    <div className="mt-3 pt-3 border-t border-charcoal/8 flex flex-col gap-3">
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
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ── Session row ─────────────────────────────────────────────────────── */
function SessionRow({ session, onReload, isManagerEdit = false }) {
  const [editing, setEditing] = useState(false)

  const durationMs = session.clockOutAt
    ? session.clockOutAt - session.clockInAt - session.breakMinutes * 60000
    : null

  return (
    <div className="py-3 border-t border-charcoal/6 first:border-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal">{sessionDateLabel(session.date)}</p>
          <p className="text-xs text-charcoal/40 mt-0.5">
            {format(session.clockInAt, 'HH:mm')}
            {' → '}
            {session.clockOutAt
              ? format(session.clockOutAt, 'HH:mm')
              : <span className="text-warning">active</span>}
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

      {editing && (
        <EditSessionForm
          session={session}
          onSave={() => { setEditing(false); onReload() }}
          onCancel={() => setEditing(false)}
          isManagerEdit={isManagerEdit}
        />
      )}
    </div>
  )
}

/* ── Add shift form ──────────────────────────────────────────────────── */
function AddShiftForm({ staffId, onSave, onCancel }) {
  const toast = useToast()
  const { venueId } = useVenue()

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), i)
    return {
      value: format(d, 'yyyy-MM-dd'),
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : format(d, 'EEE, d MMM'),
    }
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
    // Use SECURITY DEFINER RPC — safer than a direct anon-key insert
    const { error } = await supabase.rpc('add_clock_session', {
      p_staff_id:       staffId,
      p_venue_id:       venueId,
      p_clock_in_time:  newClockIn.toISOString(),
      p_clock_out_time: newClockOut.toISOString(),
      p_break_minutes:  parseInt(breakMin, 10) || 0,
    })
    setSaving(false)
    if (error) { toast(error.message ?? 'Failed to save', 'error'); return }
    toast('Shift added')
    onSave()
  }

  return (
    <div className="mt-3 pt-3 border-t border-charcoal/8 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Date</label>
        <select value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30">
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

/* ── Main exported component ─────────────────────────────────────────── */
export default function RecentShifts({ staffId, isManagerEdit = false, inline = false }) {
  const { sessions, loading, reload } = useClockSessions(staffId)
  const [adding, setAdding] = useState(false)

  const body = (
    <>
      <div className="flex items-center justify-between mb-1">
        {!inline && <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Recent Shifts</p>}
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
    </>
  )

  if (inline) return body
  return <div className="bg-white rounded-xl p-5">{body}</div>
}
