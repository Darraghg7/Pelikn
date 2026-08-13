/**
 * useClockAlerts — late clock-in and break-overrun detection for every surface
 * that can record a clock event.
 *
 * This lived inside ClockPanel until the mobile manager dashboard grew its own
 * clock card, which called `record_clock_event` directly and so had no lateness
 * check at all: a manager clocking in late on a phone was never shown the
 * reason / manager-approval screen, no matter what Attendance settings said.
 * Keeping the logic here means a new clock surface gets the alerts by
 * construction rather than by remembering to copy 90 lines.
 *
 * Usage:
 *   const { onClockEvent, alertModalProps } = useClockAlerts({
 *     staffId, status, breakStartAt, onEndBreak: () => record('break_end'),
 *   })
 *   // in record(), after the RPC succeeds:
 *   await onClockEvent(eventType, { queued, at })
 *   // in render:
 *   <StaffAlertModal {...alertModalProps} />
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useSession } from '../contexts/SessionContext'
import { useAppSettings } from './useSettings'
import { useToast } from '../components/ui/Toast'
import { sendPush } from '../lib/sendPush'
import { londonToday, londonWallTimeToInstant, londonDayStartInstant, formatLondon } from '../lib/time'
import { captureSilent } from '../lib/reportError'
import { hashPin, pinHashKey } from '../lib/offlinePin'

/** Count active (non-dismissed) strikes of one offence type in the last 30 days, +1 for the current one */
async function countStrikes(staffId, venueId, offenceType, now) {
  const since = format(subDays(now, 30), 'yyyy-MM-dd') + 'T00:00:00'
  const { count } = await supabase
    .from('staff_disciplinary_log')
    .select('*', { count: 'exact', head: true })
    .eq('staff_id', staffId)
    .eq('venue_id', venueId)
    .eq('offence_type', offenceType)
    .is('dismissed_at', null)
    .gte('occurred_at', since)
  return (count ?? 0) + 1
}

/** The most recent event of `eventType` for this staff member today (UK day), if any */
async function fetchTodayEvent(staffId, venueId, eventType) {
  const { data } = await supabase
    .from('clock_events')
    .select('id, acknowledged_at')
    .eq('staff_id', staffId)
    .eq('venue_id', venueId)
    .eq('event_type', eventType)
    .gte('occurred_at', londonDayStartInstant().toISOString())
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** Today's shift whose start (or end) time sits closest to `at` — staff can have several rows per day */
function closestShift(shifts, today, at, field) {
  const dist = (s) => Math.abs(londonWallTimeToInstant(today, s[field]) - at)
  return shifts.reduce((best, s) => dist(s) < dist(best) ? s : best)
}

export function useClockAlerts({ staffId, status, breakStartAt, onEndBreak }) {
  const { venueId } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const {
    requireLateReason,
    requireManagerApprovalForLate,
    breakDurationMins: breakAllowanceMins,
    lateGraceMins,
  } = useAppSettings()

  // { type, minsOver, strikeCount, scheduledTime, actualTime, breakStartTime,
  //   takenMins, breakAllowanceMins, clockEventId, breakStillActive }
  const [alert, setAlert] = useState(null)
  const breakAlertShownRef = useRef(false)

  // Reset the break-alert guard when a new break starts
  useEffect(() => {
    if (status === 'on_break') breakAlertShownRef.current = false
  }, [breakStartAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live break-overrun detection — check every 15s while on break
  useEffect(() => {
    if (status !== 'on_break' || !breakStartAt || !venueId) return

    const check = async () => {
      if (breakAlertShownRef.current) return
      const elapsedMins = (Date.now() - breakStartAt.getTime()) / 60000
      if (elapsedMins < breakAllowanceMins) return

      breakAlertShownRef.current = true
      const minsOver = Math.floor(elapsedMins - breakAllowanceMins)

      const ev = await fetchTodayEvent(staffId, venueId, 'break_start')
      if (!ev || ev.acknowledged_at) return // already acknowledged

      const strikes = await countStrikes(staffId, venueId, 'break_overrun', new Date())

      setAlert({
        type: 'break_overrun',
        minsOver,
        strikeCount: strikes,
        breakStartTime: formatLondon(breakStartAt, 'HH:mm'),
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

  /**
   * Run the post-event checks. Call after `record_clock_event` succeeds.
   * @param eventType  clock_in | clock_out | break_start | break_end
   * @param at         when the button was tapped — not when the RPC returned,
   *                   so a slow round trip can't make a punctual clock-in late
   */
  const onClockEvent = useCallback(async (eventType, { queued = false, at = new Date() } = {}) => {
    if (queued || !venueId || !staffId) return

    // ── Late clock-in ────────────────────────────────────────────────────────
    if (eventType === 'clock_in') {
      const today = londonToday()
      const { data: shifts } = await supabase
        .from('shifts')
        .select('start_time, end_time, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('staff_id', staffId)
        .eq('shift_date', today)
        .order('start_time')
      if (!shifts?.length) {
        // No rota row does not block clock-in — some venues don't run a rota
        // at all. Flag it instead: a warning to the person clocking in, and a
        // push to managers/owners. Unknown role flags anyway (a missed
        // compliance signal costs more than one spurious manager ping).
        // Managers/owners are routinely off-rota, so they're exempt.
        const role = session?.staffRole
        if (role !== 'manager' && role !== 'owner') {
          toast('Clocked in — no shift scheduled today', 'warning')
          sendPush({
            venueId,
            notificationType: 'unscheduled_clock_in',
            title: 'Unscheduled Clock-In',
            body: `${session?.staffName ?? 'A staff member'} clocked in with no shift scheduled`,
            url: '/timesheet',
            roles: ['manager', 'owner'],
          })
        }
        return
      }

      // Scheduled times are UK wall-clock (Europe/London), whatever the device tz.
      const shift      = closestShift(shifts, today, at, 'start_time')
      const shiftStart = londonWallTimeToInstant(today, shift.start_time)
      const msLate     = at.getTime() - shiftStart.getTime()

      // Anything past the venue's grace period is late. The default grace of 0
      // means part of a minute counts — which is why the modal has a "< 1 min"
      // state. Venues that want slack set `late_grace_mins` in Attendance.
      if (msLate <= lateGraceMins * 60000) return

      const minsLate = Math.floor(msLate / 60000)

      // Notify managers (escalation level handled by strike count in the modal)
      sendPush({
        venueId,
        notificationType: 'late_clock_in',
        title: 'Late Clock-In',
        body:  minsLate >= 1
          ? `${shift.staff?.name ?? 'A staff member'} clocked in ${minsLate} min late`
          : `${shift.staff?.name ?? 'A staff member'} clocked in late`,
        url:   '/timesheet',
        roles: ['manager', 'owner'],
      })

      // Never let a failed lookup suppress the alert — the staff member must
      // always see the late window (and manager approval if enabled).
      let strikes = 1, ev = null
      try {
        [strikes, ev] = await Promise.all([
          countStrikes(staffId, venueId, 'late_clock_in', at),
          fetchTodayEvent(staffId, venueId, 'clock_in'),
        ])
      } catch { /* show the alert with defaults */ }

      if (ev?.acknowledged_at) return // already acknowledged this event

      // 3rd+ strike: additional manager push
      if (strikes >= 3) {
        sendPush({
          venueId,
          notificationType: 'repeat_offender',
          title: strikes >= 4 ? 'Disciplinary Review Triggered' : 'Repeat Late Clock-In',
          body:  `${shift.staff?.name ?? 'A staff member'} — ${strikes} late clock-ins in 30 days`,
          url:   '/timesheet',
          roles: ['manager', 'owner'],
        })
      }

      setAlert({
        type: 'late_clock_in',
        minsOver: minsLate,
        strikeCount: strikes,
        scheduledTime: formatLondon(shiftStart, 'HH:mm'),
        actualTime: formatLondon(at, 'HH:mm'),
        clockEventId: ev?.id ?? null,
        breakStillActive: false,
      })
      return
    }

    // ── Early clock-out ──────────────────────────────────────────────────────
    if (eventType === 'clock_out') {
      const today = londonToday()
      const { data: shifts } = await supabase
        .from('shifts')
        .select('end_time, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('staff_id', staffId)
        .eq('shift_date', today)
        .order('start_time')
      if (!shifts?.length) return

      const shift     = closestShift(shifts, today, at, 'end_time')
      const shiftEnd  = londonWallTimeToInstant(today, shift.end_time)
      const minsEarly = Math.round((shiftEnd - at) / 60000)
      if (minsEarly > 15) {
        sendPush({
          venueId,
          notificationType: 'early_clock_out',
          title: 'Early Clock-Out',
          body:  `${shift.staff?.name ?? 'A staff member'} clocked out ${minsEarly} min early`,
          url:   '/timesheet',
          roles: ['manager', 'owner'],
        })
      }
      return
    }

    // ── Break-end overrun (if the live trigger didn't already fire) ──────────
    if (eventType === 'break_end' && breakStartAt) {
      const elapsedMins = (at.getTime() - breakStartAt.getTime()) / 60000
      if (elapsedMins <= breakAllowanceMins || breakAlertShownRef.current) return

      breakAlertShownRef.current = true
      const minsOver = Math.floor(elapsedMins - breakAllowanceMins)
      const [ev, strikes] = await Promise.all([
        fetchTodayEvent(staffId, venueId, 'break_start'),
        countStrikes(staffId, venueId, 'break_overrun', at),
      ])
      if (!ev || ev.acknowledged_at) return

      setAlert({
        type: 'break_overrun',
        minsOver,
        strikeCount: strikes,
        breakStartTime: formatLondon(breakStartAt, 'HH:mm'),
        takenMins: Math.floor(elapsedMins),
        breakAllowanceMins,
        clockEventId: ev.id,
        breakStillActive: false,
      })
    }
  }, [staffId, venueId, breakStartAt, breakAllowanceMins, lateGraceMins, session?.staffRole, session?.staffName, toast])

  const handleAcknowledge = useCallback(async (reason) => {
    const current = alert
    setAlert(null) // always close immediately — never leave staff trapped

    if (!current?.clockEventId) return

    // Acknowledge in the background; fall back to a direct update if the RPC is missing
    const { error } = await supabase.rpc('acknowledge_clock_alert', {
      p_clock_event_id:  current.clockEventId,
      p_alert_reason:    reason,
      p_strike_number:   current.strikeCount,
      p_mins_over:       current.minsOver,
      p_offence_type:    current.type,
      p_is_disciplinary: true,
    })
    if (error) {
      supabase
        .from('clock_events')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', current.clockEventId)
        .then(
          ({ error: ackErr }) => { if (ackErr) captureSilent(ackErr, 'useClockAlerts:ack-clock-event') },
          (e) => captureSilent(e, 'useClockAlerts:ack-clock-event'),
        )
    }

    if (current.type === 'break_overrun' && current.breakStillActive) {
      await onEndBreak?.()
    }
  }, [alert, onEndBreak])

  // Manager list for the approval screen, from the staff cache populated at
  // login (no extra fetch). Falls back to the DB when this device has no cache,
  // so the approval screen always has managers to select.
  const [managers, setManagers] = useState([])
  useEffect(() => {
    if (!venueId) { setManagers([]); return }
    try {
      const cached = localStorage.getItem(`pelikn_staff_${venueId}`)
      const all = cached ? JSON.parse(cached) : []
      const fromCache = all.filter(s => s.role === 'manager' || s.role === 'owner')
      if (fromCache.length > 0) { setManagers(fromCache); return }
    } catch { /* fall through to DB fetch */ }
    let cancelled = false
    supabase
      .from('staff')
      .select('id, name, role, photo_url')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .in('role', ['manager', 'owner'])
      .order('name')
      .then(({ data }) => { if (!cancelled && data) setManagers(data) })
    return () => { cancelled = true }
  }, [venueId])

  // Verify a manager's PIN — online first, offline hash fallback. The
  // offline check reuses the hash SessionContext caches under
  // pinHashKey(staffId) after that manager's last online login on this
  // device, so it only works if they've signed in here before while
  // online. `managers` is already pre-filtered to manager/owner roles
  // (see above), so a hash match there is enough to confirm access.
  const verifyManagerPin = useCallback(async (managerId, pin) => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
        body: JSON.stringify({ action: 'verify_pin', staff_id: managerId, pin, venue_id: venueId }),
        signal: AbortSignal.timeout(6000),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        if (!['manager', 'owner'].includes(data.role)) {
          return { ok: false, error: "This account doesn't have manager access" }
        }
        return { ok: true }
      }
      if (res.status === 429) return { ok: false, error: 'Too many attempts — wait a moment' }
      return { ok: false, error: 'Incorrect PIN, try again' }
    } catch { /* network unreachable — fall through to the offline check */ }

    const cachedHash = localStorage.getItem(pinHashKey(managerId))
    if (!cachedHash) {
      return { ok: false, error: "Couldn't reach the server — check your connection and try again" }
    }
    const enteredHash = await hashPin(managerId, pin)
    if (!enteredHash || enteredHash !== cachedHash) {
      return { ok: false, error: 'Incorrect PIN, try again' }
    }
    return { ok: true }
  }, [venueId])

  return {
    onClockEvent,
    breakAllowanceMins,
    alertModalProps: {
      open: !!alert,
      type: alert?.type,
      minsOver: alert?.minsOver ?? 0,
      strikeCount: alert?.strikeCount ?? 1,
      scheduledTime: alert?.scheduledTime,
      actualTime: alert?.actualTime,
      breakStartTime: alert?.breakStartTime,
      breakAllowanceMins: alert?.breakAllowanceMins ?? breakAllowanceMins,
      takenMins: alert?.takenMins,
      requireLateReason,
      requireManagerApproval: requireManagerApprovalForLate && alert?.type === 'late_clock_in',
      managers,
      onVerifyManagerPin: verifyManagerPin,
      onAcknowledge: handleAcknowledge,
    },
  }
}
