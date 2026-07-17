/**
 * RecentShifts — last 7 days of sessions for a staff member.
 *
 * Staff edit flow (non-manager):
 *   1. Tap Edit → adjust times
 *   2. Tap Save → confirmation dialog explaining manager approval is required
 *   3. Confirm → submit_clock_edit_request RPC (does NOT touch clock_events yet)
 *   4. Session row shows "Pending approval" badge until reviewed
 *
 * Manager edit flow (isManagerEdit = true):
 *   Skips the confirmation and pending-request path — applies directly via
 *   edit_clock_session, same as before.
 */
import React, { useEffect, useState } from 'react'
import { format, isToday, isYesterday, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { offlineRpc } from '../../lib/offlineSupabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useClockSessions } from '../../hooks/useClockSessions'
import { useToast } from '../ui/Toast'
import { sendPush } from '../../lib/sendPush'
import { captureSilent } from '../../lib/reportError'
import { londonWallTimeToInstant, londonDateStr, formatLondon } from '../../lib/time'
import LoadingSpinner from '../ui/LoadingSpinner'

/* ── Helpers ─────────────────────────────────────────────────────────── */
function sessionDateLabel(date) {
  if (isToday(date))     return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE, d MMM')
}

function formatElapsed(ms) {
  if (!ms || ms < 0) ms = 0
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}h ${pad(m)}m`
}

const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90]

/* ── Confirmation dialog ─────────────────────────────────────────────── */
function ConfirmDialog({ onConfirm, onCancel, saving }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: '20px 20px 0 0',
          padding: '28px 24px 32px', width: '100%', maxWidth: 480,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 14, marginBottom: 16,
          background: '#fbeedc', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a85d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>

        <h2 className="text-[17px] font-bold text-charcoal" style={{ margin: '0 0 8px' }}>
          Your manager will be notified
        </h2>
        <p className="text-sm text-charcoal/50 leading-relaxed" style={{ margin: '0 0 24px' }}>
          This change won't take effect until your manager reviews and approves it.
          Your original hours will remain until then.
        </p>

        <button
          onClick={onConfirm}
          disabled={saving}
          className="w-full text-[15px] font-semibold text-white bg-brand rounded-xl py-3.5 border-none disabled:opacity-60 disabled:cursor-not-allowed mb-2.5"
          style={{ cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Submitting…' : 'Submit for approval'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="w-full text-sm font-medium text-charcoal/50 bg-transparent rounded-xl py-3 border-none cursor-pointer"
        >
          Go back
        </button>
      </div>
    </div>
  )
}

/* ── Inline edit form ────────────────────────────────────────────────── */
function EditSessionForm({ session, staffId, onSave, onCancel, isManagerEdit }) {
  const toast        = useToast()
  const { venueId }  = useVenue()
  const { session: authSession } = useSession()

  const [clockIn,  setClockIn]  = useState(formatLondon(session.clockInAt,  'HH:mm'))
  const [clockOut, setClockOut] = useState(session.clockOutAt ? formatLondon(session.clockOutAt, 'HH:mm') : '')
  const [breakMin, setBreakMin] = useState(String(session.breakMinutes))
  const [reason,   setReason]   = useState('')

  // Two-step for staff: first validate, then show confirm dialog
  const [confirming, setConfirming] = useState(false)
  const [saving,     setSaving]     = useState(false)

  // Combine an edited HH:mm with the session's UK calendar date, interpreting
  // the time as UK wall-clock (Europe/London) so the stored UTC instant is
  // correct regardless of the editor's device timezone.
  const parseTime = (timeStr, referenceDate) => {
    return londonWallTimeToInstant(londonDateStr(referenceDate), timeStr)
  }

  const validate = () => {
    const newIn  = parseTime(clockIn, session.clockInAt)
    const newOut = clockOut ? parseTime(clockOut, session.clockInAt) : null
    if (newOut && newOut <= newIn) {
      toast('Clock out must be after clock in', 'error')
      return false
    }
    return true
  }

  // Manager path: direct edit, same as before
  const saveManagerEdit = async () => {
    if (!validate()) return
    setSaving(true)
    const newIn  = parseTime(clockIn, session.clockInAt)
    const newOut = clockOut ? parseTime(clockOut, session.clockInAt) : null
    const { error } = await offlineRpc('edit_clock_session', {
      p_clock_in_id:    session.clockInId,
      p_clock_in_time:  newIn.toISOString(),
      p_clock_out_id:   session.clockOutId ?? null,
      p_clock_out_time: newOut?.toISOString() ?? null,
      p_break_minutes:  parseInt(breakMin, 10) || 0,
    })
    setSaving(false)
    if (error) { toast(error.message ?? 'Failed to save', 'error'); return }
    toast('Shift updated')
    onSave()
  }

  // Staff path: submit pending request
  const submitRequest = async () => {
    setSaving(true)
    const newIn  = parseTime(clockIn, session.clockInAt)
    const newOut = clockOut ? parseTime(clockOut, session.clockInAt) : null

    const { error } = await supabase.rpc('submit_clock_edit_request', {
      p_venue_id:            venueId,
      p_staff_id:            staffId,
      p_clock_in_id:         session.clockInId,
      p_clock_out_id:        session.clockOutId ?? null,
      p_original_clock_in:   session.clockInAt.toISOString(),
      p_original_clock_out:  session.clockOutAt?.toISOString() ?? null,
      p_requested_clock_in:  newIn.toISOString(),
      p_requested_clock_out: newOut?.toISOString() ?? null,
      p_break_minutes:       parseInt(breakMin, 10) || 0,
      p_reason:              reason.trim() || null,
    })
    setSaving(false)

    if (error) { toast(error.message ?? 'Failed to submit', 'error'); setConfirming(false); return }

    // Push notification to managers
    sendPush({
      venueId,
      notificationType: 'hour_edit_request',
      title: 'Hour edit request',
      body: `${authSession?.staffName ?? 'A staff member'} requested a change to their hours on ${formatLondon(session.clockInAt, 'd MMM')}`,
      url: '/timesheet',
      roles: ['manager', 'owner'],
    }).catch(() => {})

    toast('Edit submitted — awaiting manager approval')
    setConfirming(false)
    onSave()
  }

  const handleSaveClick = () => {
    if (!validate()) return
    if (isManagerEdit) { saveManagerEdit(); return }
    setConfirming(true)
  }

  return (
    <>
      <div className="mt-3 pt-3 border-t border-charcoal/8 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Clock In</label>
            <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)}
              className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Clock Out</label>
            <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)}
              className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Break</label>
          <select value={breakMin} onChange={(e) => setBreakMin(e.target.value)}
            className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30">
            {BREAK_OPTIONS.map((m) => <option key={m} value={String(m)}>{m === 0 ? 'No break' : `${m} min`}</option>)}
          </select>
        </div>
        {/* Reason field — only for staff (helps manager review) */}
        {!isManagerEdit && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Reason <span className="normal-case">(optional)</span></label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. forgot to clock out"
              className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-charcoal/60 bg-charcoal/6 hover:bg-charcoal/10 transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button onClick={handleSaveClick} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : isManagerEdit ? 'Save' : 'Request change'}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          onConfirm={submitRequest}
          onCancel={() => setConfirming(false)}
          saving={saving}
        />
      )}
    </>
  )
}

/* ── Session row ─────────────────────────────────────────────────────── */
function SessionRow({ session, staffId, onReload, isManagerEdit, pendingRequests }) {
  const [editing, setEditing] = useState(false)

  const durationMs = session.clockOutAt
    ? session.clockOutAt - session.clockInAt - session.breakMinutes * 60000
    : null

  // Does this session have a pending edit request?
  const pending = pendingRequests.find(r => r.clock_in_id === session.clockInId && r.status === 'pending')
  const denied  = pendingRequests.find(r => r.clock_in_id === session.clockInId && r.status === 'denied')

  return (
    <div className="py-3 border-t border-charcoal/6 first:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal">{sessionDateLabel(session.date)}</p>
          <p className="text-xs text-charcoal/40 mt-0.5">
            {formatLondon(session.clockInAt, 'HH:mm')}
            {' → '}
            {session.clockOutAt
              ? formatLondon(session.clockOutAt, 'HH:mm')
              : <span className="text-warning">active</span>}
            {session.breakMinutes > 0 && (
              <span className="ml-1.5 text-charcoal/30">· {session.breakMinutes}m break</span>
            )}
          </p>
          {/* Status badges */}
          {pending && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
              <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
              Pending approval
            </span>
          )}
          {denied && !pending && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-danger/8 text-danger border border-danger/15">
              Edit not approved
              {denied.manager_note && <span className="normal-case font-normal ml-1">· {denied.manager_note}</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {durationMs !== null && (
            <span className="font-mono text-sm text-charcoal/60 tabular-nums">
              {formatElapsed(durationMs)}
            </span>
          )}
          {/* Don't allow another edit while one is pending */}
          {!pending && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-medium text-brand/70 hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/8"
            >
              {editing ? 'Close' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <EditSessionForm
          session={session}
          staffId={staffId}
          onSave={() => { setEditing(false); onReload() }}
          onCancel={() => setEditing(false)}
          isManagerEdit={isManagerEdit}
        />
      )}
    </div>
  )
}

/* ── Add shift form ──────────────────────────────────────────────────── */
function AddShiftForm({ staffId, onSave, onCancel, isManagerEdit = false }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session: authSession } = useSession()

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
  const [reason,   setReason]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [confirming, setConfirming] = useState(false)

  const validate = () => {
    const newClockIn  = londonWallTimeToInstant(date, clockIn)
    const newClockOut = londonWallTimeToInstant(date, clockOut)
    if (newClockOut <= newClockIn) { toast('Clock out must be after clock in', 'error'); return false }
    return true
  }

  const saveManagerAdd = async () => {
    setSaving(true)
    const newClockIn  = londonWallTimeToInstant(date, clockIn)
    const newClockOut = londonWallTimeToInstant(date, clockOut)
    const { data, error } = await supabase.rpc('add_clock_session', {
      p_staff_id:       staffId,
      p_venue_id:       venueId,
      p_clock_in_time:  newClockIn.toISOString(),
      p_clock_out_time: newClockOut.toISOString(),
      p_break_minutes:  parseInt(breakMin, 10) || 0,
    })
    setSaving(false)
    if (error) { toast(error.message ?? 'Failed to save', 'error'); return }
    if (!isManagerEdit && data) supabase.rpc('log_hour_edit', { p_clock_in_id: data }).then(({ error: logErr }) => { if (logErr) captureSilent(logErr, 'RecentShifts:log_hour_edit') }, (e) => captureSilent(e, 'RecentShifts:log_hour_edit'))
    toast('Shift added')
    onSave()
  }

  // Staff submitting an "add missed shift" request — use the same pending flow
  const submitAddRequest = async () => {
    setSaving(true)
    const newClockIn  = londonWallTimeToInstant(date, clockIn)
    const newClockOut = londonWallTimeToInstant(date, clockOut)

    // For an "add" we have no existing clock_in_id/clock_out_id
    const { error } = await supabase.rpc('submit_clock_edit_request', {
      p_venue_id:            venueId,
      p_staff_id:            staffId,
      p_clock_in_id:         null,
      p_clock_out_id:        null,
      p_original_clock_in:   null,
      p_original_clock_out:  null,
      p_requested_clock_in:  newClockIn.toISOString(),
      p_requested_clock_out: newClockOut.toISOString(),
      p_break_minutes:       parseInt(breakMin, 10) || 0,
      p_reason:              reason.trim() || 'Missed punch — add shift',
    })
    setSaving(false)
    if (error) { toast(error.message ?? 'Failed to submit', 'error'); setConfirming(false); return }

    sendPush({
      venueId,
      notificationType: 'hour_edit_request',
      title: 'Missing shift reported',
      body: `${authSession?.staffName ?? 'A staff member'} reported a missed clock-in on ${date}`,
      url: '/timesheet',
      roles: ['manager', 'owner'],
    }).catch(() => {})

    toast('Shift request submitted — awaiting manager approval')
    setConfirming(false)
    onSave()
  }

  const handleAdd = () => {
    if (!validate()) return
    if (isManagerEdit) { saveManagerAdd(); return }
    setConfirming(true)
  }

  return (
    <>
      <div className="mt-3 pt-3 border-t border-charcoal/8 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Date</label>
          <select value={date} onChange={(e) => setDate(e.target.value)}
            className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30">
            {dateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Clock In</label>
            <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)}
              className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Clock Out</label>
            <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)}
              className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Break</label>
          <select value={breakMin} onChange={(e) => setBreakMin(e.target.value)}
            className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30">
            {BREAK_OPTIONS.map((m) => <option key={m} value={String(m)}>{m === 0 ? 'No break' : `${m} min`}</option>)}
          </select>
        </div>
        {!isManagerEdit && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40">Reason <span className="normal-case">(optional)</span></label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. forgot to clock in"
              className="bg-charcoal/4 rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-charcoal/60 bg-charcoal/6 hover:bg-charcoal/10 transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button onClick={handleAdd} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : isManagerEdit ? 'Add Shift' : 'Request shift'}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          onConfirm={submitAddRequest}
          onCancel={() => setConfirming(false)}
          saving={saving}
        />
      )}
    </>
  )
}

/* ── Main exported component ─────────────────────────────────────────── */
export default function RecentShifts({ staffId, isManagerEdit = false, inline = false }) {
  const { venueId }  = useVenue()
  const { sessions, loading, reload } = useClockSessions(staffId)
  const [adding, setAdding]             = useState(false)
  const [pendingRequests, setPending]   = useState([])

  // Fetch pending/denied requests for this staff member so we can show badges
  useEffect(() => {
    if (!staffId || !venueId) return
    supabase
      .from('clock_edit_requests')
      .select('id, clock_in_id, status, manager_note')
      .eq('staff_id', staffId)
      .eq('venue_id', venueId)
      .in('status', ['pending', 'denied'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setPending(data ?? []))
  }, [staffId, venueId, loading]) // re-fetch when sessions reload

  const body = (
    <>
      <div className="flex items-center justify-between mb-1">
        {!inline && <p className="text-[11px] tracking-widests uppercase text-charcoal/40">Recent Shifts</p>}
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-brand/70 hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/8"
          >
            + Add shift
          </button>
        )}
      </div>
      <p className="text-xs text-charcoal/30 mb-3">
        {isManagerEdit
          ? 'Edit sessions directly. Changes take effect immediately.'
          : 'Tap Edit to correct a mistake. Your manager will approve the change.'}
      </p>

      {adding && (
        <AddShiftForm
          staffId={staffId}
          isManagerEdit={isManagerEdit}
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
            <SessionRow
              key={s.clockInId}
              session={s}
              staffId={staffId}
              onReload={reload}
              isManagerEdit={isManagerEdit}
              pendingRequests={pendingRequests}
            />
          ))}
        </div>
      )}
    </>
  )

  if (inline) return body
  return <div className="bg-white rounded-2xl p-5">{body}</div>
}
