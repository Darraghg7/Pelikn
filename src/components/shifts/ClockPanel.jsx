/**
 * ClockPanel — inline clock-in/out/break widget with live elapsed timer.
 * Persists across logouts: timer is derived from DB timestamps, not local state.
 */
import React, { useEffect, useRef, useState } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { offlineRpc } from '../../lib/offlineSupabase'
import { useClockStatus, saveClockStatusCache } from '../../hooks/useClockEvents'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../ui/Toast'
import LoadingSpinner from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import StaffAlertModal from './StaffAlertModal'
import { useAppSettings as useSettings } from '../../hooks/useSettings'

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

/** Count late clock-ins for this staff in the last 30 days (threshold: any positive lateness) */
async function countLateStrikes(staffId, venueId, now) {
  const since = format(subDays(now, 30), 'yyyy-MM-dd')
  const today = format(now, 'yyyy-MM-dd')

  const [{ data: shifts }, { data: clockIns }] = await Promise.all([
    supabase
      .from('shifts')
      .select('shift_date, start_time')
      .eq('staff_id', staffId)
      .eq('venue_id', venueId)
      .gte('shift_date', since)
      .lte('shift_date', today),
    supabase
      .from('clock_events')
      .select('occurred_at')
      .eq('staff_id', staffId)
      .eq('venue_id', venueId)
      .eq('event_type', 'clock_in')
      .gte('occurred_at', since + 'T00:00:00'),
  ])

  if (!shifts?.length || !clockIns?.length) return 1

  let count = 0
  for (const shift of shifts) {
    const ci = clockIns.find(c => c.occurred_at.startsWith(shift.shift_date))
    if (!ci) continue
    const shiftStart  = new Date(shift.shift_date + 'T' + shift.start_time)
    const clockInTime = parseISO(ci.occurred_at)
    if (clockInTime > shiftStart) count++
  }

  return Math.max(count, 1)
}

/** Fetch the most recent clock_in event ID + acknowledged_at for this staff today */
async function fetchTodayClockInEvent(staffId, venueId) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('clock_events')
    .select('id, acknowledged_at')
    .eq('staff_id', staffId)
    .eq('venue_id', venueId)
    .eq('event_type', 'clock_in')
    .gte('occurred_at', today + 'T00:00:00')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** Fetch the most recent break_start event ID + acknowledged_at for this staff today */
async function fetchTodayBreakStartEvent(staffId, venueId) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('clock_events')
    .select('id, acknowledged_at')
    .eq('staff_id', staffId)
    .eq('venue_id', venueId)
    .eq('event_type', 'break_start')
    .gte('occurred_at', today + 'T00:00:00')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** Count break overrun strikes for this staff in the last 30 days */
async function countBreakStrikes(staffId, venueId, now) {
  const since = format(subDays(now, 30), 'yyyy-MM-dd')
  const today = format(now, 'yyyy-MM-dd')

  const { data: events } = await supabase
    .from('clock_events')
    .select('event_type, occurred_at')
    .eq('staff_id', staffId)
    .eq('venue_id', venueId)
    .in('event_type', ['break_start', 'break_end'])
    .gte('occurred_at', since + 'T00:00:00')
    .lte('occurred_at', today + 'T23:59:59')
    .order('occurred_at', { ascending: true })

  if (!events?.length) return 1

  const { data: settingsRows } = await supabase
    .from('app_settings')
    .select('value')
    .eq('venue_id', venueId)
    .eq('key', 'break_duration_mins')
    .maybeSingle()
  const allowanceMins = settingsRows ? JSON.parse(settingsRows.value) : 30

  let count = 0
  let lastBreakStart = null
  for (const ev of events) {
    if (ev.event_type === 'break_start') {
      lastBreakStart = parseISO(ev.occurred_at)
    } else if (ev.event_type === 'break_end' && lastBreakStart) {
      const takenMins = (parseISO(ev.occurred_at).getTime() - lastBreakStart.getTime()) / 60000
      if (takenMins > allowanceMins) count++
      lastBreakStart = null
    }
  }

  return Math.max(count, 1)
}

export default function ClockPanel({ staffId, hasShift = true, compact = false }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { requireLateReason } = useSettings()
  const { status, clockInAt, breakStartAt, totalBreakMs, loading, reload } = useClockStatus(staffId)
  const [submitting, setSubmitting] = useState(false)

  // Break allowance from venue settings (fetched once)
  const [breakAllowanceMins, setBreakAllowanceMins] = useState(30)
  useEffect(() => {
    if (!venueId) return
    supabase
      .from('app_settings')
      .select('value')
      .eq('venue_id', venueId)
      .eq('key', 'break_duration_mins')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setBreakAllowanceMins(JSON.parse(data.value))
      })
  }, [venueId])

  // Alert modal state
  const [alert, setAlert] = useState(null) // { type, minsOver, strikeCount, scheduledTime, actualTime, breakStartTime, takenMins, clockEventId, breakStillActive }
  const breakAlertShownRef = useRef(false)

  // Reset break alert guard when a new break starts
  useEffect(() => {
    if (status === 'on_break') {
      breakAlertShownRef.current = false
    }
  }, [breakStartAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live break overrun detection — check every 15s when on break
  useEffect(() => {
    if (status !== 'on_break' || !breakStartAt || !venueId) return

    const check = async () => {
      if (breakAlertShownRef.current) return
      const elapsedMins = (Date.now() - breakStartAt.getTime()) / 60000
      if (elapsedMins < breakAllowanceMins) return

      breakAlertShownRef.current = true
      const minsOver = Math.floor(elapsedMins - breakAllowanceMins)

      const ev = await fetchTodayBreakStartEvent(staffId, venueId)
      if (!ev || ev.acknowledged_at) return // already acknowledged

      const strikes = await countBreakStrikes(staffId, venueId, new Date())

      setAlert({
        type: 'break_overrun',
        minsOver,
        strikeCount: strikes,
        breakStartTime: format(breakStartAt, 'HH:mm'),
        takenMins: Math.floor(elapsedMins),
        breakAllowanceMins,
        clockEventId: ev.id,
        breakStillActive: true,
      })
    }

    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [status, breakStartAt, breakAllowanceMins, staffId, venueId])

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

    // ── Late clock-in check ──────────────────────────────────────────────────
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
        .then(async ({ data: shift }) => {
          if (!shift) return
          // Floor both times to whole minutes before comparing so that
          // a sub-minute clock-in (e.g. 07:00:40) isn't flagged as late.
          const shiftStart   = new Date(today + 'T' + shift.start_time)
          const nowFloored   = new Date(Math.floor(now.getTime() / 60000) * 60000)
          const startFloored = new Date(Math.floor(shiftStart.getTime() / 60000) * 60000)
          const msLate       = nowFloored.getTime() - startFloored.getTime()

          if (msLate >= 60000) { // >= 1 whole minute late
            const minsLate = Math.floor(msLate / 60000)

            // Notify managers (escalation level handled by strike count in modal)
            sendPush({
              venueId,
              notificationType: 'late_clock_in',
              title: 'Late Clock-In',
              body:  minsLate >= 1
                ? `${shift.staff?.name ?? 'A staff member'} clocked in ${minsLate} min late`
                : `${shift.staff?.name ?? 'A staff member'} clocked in late`,
              url:   '/timesheet',
              roles: ['manager', 'owner'],
            }).catch(() => {})

            const [strikes, ev] = await Promise.all([
              countLateStrikes(staffId, venueId, now),
              fetchTodayClockInEvent(staffId, venueId),
            ])

            if (!ev || ev.acknowledged_at) return // already acknowledged this event

            // 3rd+ strike: additional manager push
            if (strikes >= 3) {
              sendPush({
                venueId,
                notificationType: 'repeat_offender',
                title: strikes >= 4 ? 'Disciplinary Review Triggered' : 'Repeat Late Clock-In',
                body:  `${shift.staff?.name ?? 'A staff member'} — ${strikes} late clock-ins in 30 days`,
                url:   '/timesheet',
                roles: ['manager', 'owner'],
              }).catch(() => {})
            }

            setAlert({
              type: 'late_clock_in',
              minsOver: minsLate,
              strikeCount: strikes,
              scheduledTime: format(shiftStart, 'HH:mm'),
              actualTime: format(now, 'HH:mm'),
              clockEventId: ev.id,
              breakStillActive: false,
            })
          }
        })
    }

    // ── Early clock-out check ────────────────────────────────────────────────
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
              notificationType: 'early_clock_out',
              title: 'Early Clock-Out',
              body:  `${shift.staff?.name ?? 'A staff member'} clocked out ${minsEarly} min early`,
              url:   '/timesheet',
              roles: ['manager', 'owner'],
            }).catch(() => {})
          }
        })
    }

    // ── Break-end overrun check (if live trigger didn't already fire) ────────
    if (eventType === 'break_end' && !queued && breakStartAt) {
      const elapsedMins = (Date.now() - breakStartAt.getTime()) / 60000
      if (elapsedMins > breakAllowanceMins && !breakAlertShownRef.current) {
        breakAlertShownRef.current = true
        const minsOver = Math.floor(elapsedMins - breakAllowanceMins)
        const [ev, strikes] = await Promise.all([
          fetchTodayBreakStartEvent(staffId, venueId),
          countBreakStrikes(staffId, venueId, new Date()),
        ])
        if (ev && !ev.acknowledged_at) {
          setAlert({
            type: 'break_overrun',
            minsOver,
            strikeCount: strikes,
            breakStartTime: format(breakStartAt, 'HH:mm'),
            takenMins: Math.floor(elapsedMins),
            breakAllowanceMins,
            clockEventId: ev.id,
            breakStillActive: false,
          })
        }
      }
    }

    if (queued) {
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

  const handleAcknowledge = async (reason) => {
    if (!alert?.clockEventId) { setAlert(null); return }

    supabase.rpc('acknowledge_clock_alert', {
      p_clock_event_id:  alert.clockEventId,
      p_alert_reason:    reason,
      p_strike_number:   alert.strikeCount,
      p_mins_over:       alert.minsOver,
      p_offence_type:    alert.type,
      p_is_disciplinary: true,
    }).catch(() => {})

    // If live break overrun, end the break now
    if (alert.type === 'break_overrun' && alert.breakStillActive) {
      setAlert(null)
      await record('break_end')
      return
    }

    setAlert(null)
  }

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.clocked_out

  if (loading) {
    return <div className="flex justify-center py-4"><LoadingSpinner /></div>
  }

  return (
    <>
      <StaffAlertModal
        open={!!alert}
        type={alert?.type}
        minsOver={alert?.minsOver ?? 0}
        strikeCount={alert?.strikeCount ?? 1}
        scheduledTime={alert?.scheduledTime}
        actualTime={alert?.actualTime}
        breakStartTime={alert?.breakStartTime}
        breakAllowanceMins={alert?.breakAllowanceMins ?? breakAllowanceMins}
        takenMins={alert?.takenMins}
        requireLateReason={requireLateReason}
        onAcknowledge={handleAcknowledge}
      />

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
          hasShift ? (
            <button
              onClick={() => record('clock_in')}
              disabled={submitting}
              className={compact
                ? 'w-full bg-white text-brand py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40'
                : 'w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40'}
            >
              {submitting ? '…' : 'Clock In'}
            </button>
          ) : (
            <p className={`text-xs italic text-center py-2 ${compact ? 'text-white/40' : 'text-charcoal/35'}`}>
              No shift scheduled — clock in not available
            </p>
          )
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
                ? 'flex-[1.4] bg-white text-brand py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40'
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
              ? 'w-full bg-white text-brand py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40'
              : 'w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40'}
          >
            {submitting ? '…' : 'End Break'}
          </button>
        )}
      </div>
    </>
  )
}
