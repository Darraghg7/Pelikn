/**
 * ClockPanel — inline clock-in/out/break widget with live elapsed timer.
 * Persists across logouts: timer is derived from DB timestamps, not local state.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { offlineRpc } from '../../lib/offlineSupabase'
import { useClockStatus, saveClockStatusCache } from '../../hooks/useClockEvents'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../ui/Toast'
import Skeleton from '../ui/Skeleton'
import StaffAlertModal from './StaffAlertModal'
import { useClockAlerts } from '../../hooks/useClockAlerts'

const STATUS_CONFIG = {
  clocked_out: { label: 'Not Clocked In', color: 'text-charcoal/50 dark:text-white/40', dot: 'bg-charcoal/25 dark:bg-white/25' },
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
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">Shift</p>
        <p className="font-mono text-2xl text-charcoal dark:text-white tabular-nums">{formatElapsed(workingMs)}</p>
      </div>
      {status === 'on_break' && breakStartAt && (
        <div>
          <p className="text-[11px] tracking-widest uppercase text-warning/60">Break</p>
          <p className="font-mono text-lg text-warning tabular-nums">{formatElapsed(currentBreakMs)}</p>
        </div>
      )}
      {totalBreakMs > 0 && status !== 'on_break' && (
        <p className="text-[11px] text-charcoal/30 dark:text-white/30">
          {formatElapsed(totalBreakMs)} on breaks
        </p>
      )}
    </div>
  )
}

export default function ClockPanel({ staffId, compact = false }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { status, clockInAt, breakStartAt, totalBreakMs, loading, isError, reload } = useClockStatus(staffId)
  const [submitting, setSubmitting] = useState(false)

  // Late clock-in / break-overrun alerts live in a shared hook so that every
  // clock surface behaves identically — see useClockAlerts. Ending a break from
  // the overrun modal has to come back through `record`, which is defined
  // below, so it goes via a ref to keep the callback identity stable.
  const recordRef = useRef(null)
  const { onClockEvent, alertModalProps } = useClockAlerts({
    staffId,
    status,
    breakStartAt,
    onEndBreak: useCallback(() => recordRef.current?.('break_end'), []),
  })

  const record = useCallback(async (eventType) => {
    // Captured before the RPC so a slow round trip can't make a punctual
    // clock-in look late.
    const at = new Date()
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

    if (queued) {
      let newStatus = status, newClockInAt = clockInAt, newBreakStartAt = breakStartAt, newTotalBreakMs = totalBreakMs
      if (eventType === 'clock_in')     { newStatus = 'clocked_in';  newClockInAt = at }
      if (eventType === 'clock_out')    { newStatus = 'clocked_out'; newClockInAt = null; newBreakStartAt = null; newTotalBreakMs = 0 }
      if (eventType === 'break_start')  { newStatus = 'on_break';    newBreakStartAt = at }
      if (eventType === 'break_end')    { newStatus = 'clocked_in';  newTotalBreakMs += breakStartAt ? at - breakStartAt : 0; newBreakStartAt = null }
      saveClockStatusCache(staffId, { status: newStatus, clockInAt: newClockInAt, breakStartAt: newBreakStartAt, totalBreakMs: newTotalBreakMs })
    }

    reload()
    await onClockEvent(eventType, { queued, at })
  }, [staffId, venueId, toast, status, clockInAt, breakStartAt, totalBreakMs, reload, onClockEvent])

  recordRef.current = record

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.clocked_out

  if (loading) {
    return <Skeleton className="h-24 w-full" />
  }

  // Don't render the clocked-out UI on a failed status check — someone who is
  // actually clocked in could tap "Clock In" and stack a second open session
  // on top of the one the check just failed to see.
  if (isError) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-danger">Couldn't check your clock status.</p>
        <button
          onClick={reload}
          className="w-full bg-danger/10 text-danger border border-danger/25 py-3 rounded-xl text-sm font-semibold hover:bg-danger/15 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <StaffAlertModal {...alertModalProps} />

      <div className="flex flex-col gap-3">
        {/* Status badge — hidden in compact mode (hero card shows its own) */}
        {!compact && (
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        )}

        {/* Elapsed timer — hidden in compact mode */}
        {!compact && status !== 'clocked_out' && (
          <ElapsedTimer
            clockInAt={clockInAt}
            breakStartAt={breakStartAt}
            totalBreakMs={totalBreakMs}
            status={status}
          />
        )}

        {/* Action buttons — compact=true renders on-dark variants for the hero card */}
        {status === 'clocked_out' && (
          <button
            onClick={() => record('clock_in')}
            disabled={submitting}
            className={compact
              ? 'w-full bg-white dark:bg-paperDark text-brand py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40'
              : 'w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40'}
          >
            {submitting ? '…' : 'Clock In'}
          </button>
        )}

        {status === 'clocked_in' && (
          <div className="flex gap-2">
            <button
              onClick={() => record('break_start')}
              disabled={submitting}
              className={compact
                ? 'flex-1 bg-white/10 text-white border border-white/25 py-3 rounded-xl text-sm font-semibold hover:bg-white/15 transition-colors disabled:opacity-40'
                : 'flex-1 bg-warning/15 text-warning py-3 rounded-xl text-sm font-semibold hover:bg-warning/25 transition-colors disabled:opacity-40'}
            >
              {submitting ? '…' : 'Start Break'}
            </button>
            <button
              onClick={() => record('clock_out')}
              disabled={submitting}
              className={compact
                ? 'flex-[1.4] bg-white dark:bg-paperDark text-brand py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40'
                : 'flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40'}
            >
              {submitting ? '…' : 'Clock Out'}
            </button>
          </div>
        )}

        {status === 'on_break' && (
          <button
            onClick={() => record('break_end')}
            disabled={submitting}
            className={compact
              ? 'w-full bg-white dark:bg-paperDark text-brand py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40'
              : 'w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40'}
          >
            {submitting ? '…' : 'End Break'}
          </button>
        )}
      </div>
    </>
  )
}
