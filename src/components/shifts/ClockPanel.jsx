/**
 * ClockPanel — inline clock-in/out/break widget with live elapsed timer.
 * Persists across logouts: timer is derived from DB timestamps, not local state.
 */
import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { offlineRpc } from '../../lib/offlineSupabase'
import { useClockStatus, saveClockStatusCache } from '../../hooks/useClockEvents'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../ui/Toast'
import LoadingSpinner from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'

const STATUS_CONFIG = {
  clocked_out: { label: 'Not Clocked In', color: 'text-charcoal/50', dot: 'bg-charcoal/25' },
  clocked_in:  { label: 'Clocked In',     color: 'text-success',     dot: 'bg-success'     },
  on_break:    { label: 'On Break',        color: 'text-warning',     dot: 'bg-warning'     },
}

function formatElapsed(ms) {
  if (ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function ElapsedTimer({ clockInAt, breakStartAt, totalBreakMs, status }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!clockInAt) return null

  // Total shift time = now - clockIn - completedBreaks - (currentBreakIfAny)
  const currentBreakMs = status === 'on_break' && breakStartAt
    ? now - breakStartAt.getTime()
    : 0
  const workingMs = now - clockInAt.getTime() - totalBreakMs - currentBreakMs

  return (
    <div className="flex items-baseline gap-3">
      <div>
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Shift</p>
        <p className="font-mono text-2xl text-charcoal tabular-nums">{formatElapsed(workingMs)}</p>
      </div>
      {status === 'on_break' && breakStartAt && (
        <div>
          <p className="text-[11px] tracking-widest uppercase text-warning/60">Break</p>
          <p className="font-mono text-lg text-warning tabular-nums">{formatElapsed(currentBreakMs)}</p>
        </div>
      )}
      {totalBreakMs > 0 && status !== 'on_break' && (
        <p className="text-[11px] text-charcoal/30">
          {formatElapsed(totalBreakMs)} on breaks
        </p>
      )}
    </div>
  )
}

export default function ClockPanel({ staffId, hasShift = true }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { status, clockInAt, breakStartAt, totalBreakMs, loading, reload } = useClockStatus(staffId)
  const [submitting, setSubmitting] = useState(false)

  const record = async (eventType) => {
    setSubmitting(true)
    const { error, queued } = await offlineRpc('record_clock_event', {
      p_staff_id:   staffId,
      p_event_type: eventType,
      p_venue_id:   venueId,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }

    const labels = { clock_in: 'Clocked in', clock_out: 'Clocked out', break_start: 'Break started', break_end: 'Break ended' }
    toast(queued ? `${labels[eventType]} (saved offline)` : labels[eventType])

    // If clocking in, check if late vs scheduled shift and push managers
    if (eventType === 'clock_in' && !queued) {
      const now = new Date()
      const today = format(now, 'yyyy-MM-dd')
      supabase
        .from('shifts')
        .select('start_time, end_time, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('staff_id', staffId)
        .eq('shift_date', today)
        .maybeSingle()
        .then(({ data: shift }) => {
          if (!shift) return
          const shiftStart = new Date(today + 'T' + shift.start_time)
          const minsLate = Math.round((now - shiftStart) / 60000)
          if (minsLate > 5) {
            sendPush({
              venueId,
              title: 'Late Clock-In',
              body:  `${shift.staff?.name ?? 'A staff member'} clocked in ${minsLate} min late`,
              url:   '/timesheet',
              roles: ['manager', 'owner'],
            }).catch(() => {})
          }
        })
    }

    // If clocking out, check if leaving early vs scheduled shift end
    if (eventType === 'clock_out' && !queued) {
      const now = new Date()
      const today = format(now, 'yyyy-MM-dd')
      supabase
        .from('shifts')
        .select('end_time, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('staff_id', staffId)
        .eq('shift_date', today)
        .maybeSingle()
        .then(({ data: shift }) => {
          if (!shift) return
          const shiftEnd = new Date(today + 'T' + shift.end_time)
          const minsEarly = Math.round((shiftEnd - now) / 60000)
          if (minsEarly > 15) {
            sendPush({
              venueId,
              title: 'Early Clock-Out',
              body:  `${shift.staff?.name ?? 'A staff member'} clocked out ${minsEarly} min early`,
              url:   '/timesheet',
              roles: ['manager', 'owner'],
            }).catch(() => {})
          }
        })
    }

    if (queued) {
      // Offline — update the localStorage cache so reload() returns the correct state
      const now = new Date()
      let newStatus = status, newClockInAt = clockInAt, newBreakStartAt = breakStartAt, newTotalBreakMs = totalBreakMs
      if (eventType === 'clock_in')     { newStatus = 'clocked_in';  newClockInAt = now }
      if (eventType === 'clock_out')    { newStatus = 'clocked_out'; newClockInAt = null; newBreakStartAt = null; newTotalBreakMs = 0 }
      if (eventType === 'break_start')  { newStatus = 'on_break';    newBreakStartAt = now }
      if (eventType === 'break_end')    { newStatus = 'clocked_in';  newTotalBreakMs += breakStartAt ? now - breakStartAt : 0; newBreakStartAt = null }
      saveClockStatusCache(staffId, { status: newStatus, clockInAt: newClockInAt, breakStartAt: newBreakStartAt, totalBreakMs: newTotalBreakMs })
    }

    reload()
  }

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.clocked_out

  if (loading) {
    return <div className="flex justify-center py-4"><LoadingSpinner /></div>
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Elapsed timer */}
      {status !== 'clocked_out' && (
        <ElapsedTimer
          clockInAt={clockInAt}
          breakStartAt={breakStartAt}
          totalBreakMs={totalBreakMs}
          status={status}
        />
      )}

      {/* Action buttons */}
      {status === 'clocked_out' && (
        hasShift ? (
          <button
            onClick={() => record('clock_in')}
            disabled={submitting}
            className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {submitting ? '…' : 'Clock In'}
          </button>
        ) : (
          <p className="text-xs text-charcoal/35 italic text-center py-2">No shift scheduled — clock in not available</p>
        )
      )}

      {status === 'clocked_in' && (
        <div className="flex gap-2">
          <button
            onClick={() => record('break_start')}
            disabled={submitting}
            className="flex-1 bg-warning/15 text-warning py-3 rounded-xl text-sm font-semibold hover:bg-warning/25 transition-colors disabled:opacity-40"
          >
            {submitting ? '…' : 'Start Break'}
          </button>
          <button
            onClick={() => record('clock_out')}
            disabled={submitting}
            className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {submitting ? '…' : 'Clock Out'}
          </button>
        </div>
      )}

      {status === 'on_break' && (
        <button
          onClick={() => record('break_end')}
          disabled={submitting}
          className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {submitting ? '…' : 'End Break'}
        </button>
      )}
    </div>
  )
}
