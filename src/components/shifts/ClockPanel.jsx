/**
 * ClockPanel — inline clock-in/out/break widget with live elapsed timer.
 * Persists across logouts: timer is derived from DB timestamps, not local state.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { offlineRpc } from '../../lib/offlineSupabase'
import { useClockStatus, nextClockStatus, useQueuedClockEvent } from '../../hooks/useClockEvents'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../ui/Toast'
import Skeleton from '../ui/Skeleton'
import StaffAlertModal from './StaffAlertModal'
import { useClockAlerts } from '../../hooks/useClockAlerts'
import { useClosingCheckoutGuard } from '../../hooks/useClosingCheckoutGuard'
import ClosingChecklistGateModal from './ClosingChecklistGateModal'
import Button from '../ui/Button'

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
        <p className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35">Shift</p>
        <p className="font-mono text-2xl text-charcoal dark:text-white tabular-nums">{formatElapsed(workingMs)}</p>
      </div>
      {status === 'on_break' && breakStartAt && (
        <div>
          <p className="text-micro tracking-widest uppercase text-warning/60">Break</p>
          <p className="font-mono text-lg text-warning tabular-nums">{formatElapsed(currentBreakMs)}</p>
        </div>
      )}
      {totalBreakMs > 0 && status !== 'on_break' && (
        <p className="text-caption text-charcoal/30 dark:text-white/30">
          {formatElapsed(totalBreakMs)} on breaks
        </p>
      )}
    </div>
  )
}

export default function ClockPanel({ staffId, compact = false }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { status, clockInAt, breakStartAt, totalBreakMs, loading, isError, reload, setStatus } = useClockStatus(staffId)
  const notSent = useQueuedClockEvent(staffId)
  const inFlightRef = useRef(false)

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
    // One punch at a time: the buttons swap the moment a tap lands, so a
    // quick second tap would otherwise race the first request to the server.
    if (inFlightRef.current) return
    inFlightRef.current = true

    // Captured before the RPC so a slow round trip can't make a punctual
    // clock-in look late.
    const at = new Date()
    const before = { status, clockInAt, breakStartAt, totalBreakMs }
    const after  = nextClockStatus(eventType, before, at)

    // Show the new state on the tap itself, not when the server answers —
    // that round trip is ~0.5 s on wifi and seconds on mobile data. Put back
    // below if the server refuses.
    await setStatus(after)

    let result
    try {
      result = await offlineRpc('record_clock_event', {
        p_staff_id:    staffId,
        p_event_type:  eventType,
        p_venue_id:    venueId,
        // The tap time, so a punch held on the device (no signal) still lands
        // at the moment it happened, not when it finally gets through (144).
        p_occurred_at: at.toISOString(),
      })
    } catch (err) {
      result = { error: err }
    } finally {
      inFlightRef.current = false
    }
    const { error, queued } = result
    if (error) {
      await setStatus(before)
      toast(error.message ?? 'Could not save — try again', 'error')
      return
    }

    const labels = { clock_in: 'Clocked in', clock_out: 'Clocked out', break_start: 'Break started', break_end: 'Break ended' }
    toast(queued ? `${labels[eventType]} (saved offline)` : labels[eventType])

    // Again, in case a status read that started before the write landed while
    // it was in flight. The read-back then confirms against the server.
    await setStatus(after)
    reload()
    await onClockEvent(eventType, { queued, at })
  }, [staffId, venueId, toast, status, clockInAt, breakStartAt, totalBreakMs, reload, setStatus, onClockEvent])

  recordRef.current = record

  const closingGuard = useClosingCheckoutGuard({
    staffId,
    onProceed: useCallback(() => record('clock_out'), [record]),
  })

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
        <Button
          variant="danger-ghost"
          fullWidth
          onClick={reload}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <>
      <StaffAlertModal {...alertModalProps} />
      <ClosingChecklistGateModal {...closingGuard.modalProps} />

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
          <Button
            size="lg"
            fullWidth
            variant={compact ? 'inverse' : 'primary'}
            onClick={() => record('clock_in')}
          >
            Clock In
          </Button>
        )}

        {status === 'clocked_in' && (
          <div className="flex gap-2">
            <Button
              size="lg"
              variant={compact ? 'inverse-secondary' : 'secondary'}
              onClick={() => record('break_start')}
              className="flex-1"
            >
              Start Break
            </Button>
            <Button
              size="lg"
              variant={compact ? 'inverse' : 'primary'}
              onClick={closingGuard.guardClockOut}
              className={compact ? 'flex-[1.4]' : 'flex-1'}
            >
              Clock Out
            </Button>
          </div>
        )}

        {status === 'on_break' && (
          <Button
            size="lg"
            fullWidth
            variant={compact ? 'inverse' : 'primary'}
            onClick={() => record('break_end')}
          >
            End Break
          </Button>
        )}

        {notSent && (
          <p role="status" className={`text-caption font-medium ${compact ? 'text-white/80' : 'text-warning'}`}>
            Not sent yet. This device will keep trying.
          </p>
        )}
      </div>
    </>
  )
}
