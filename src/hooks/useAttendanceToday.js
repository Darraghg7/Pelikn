import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { londonToday, londonWallTimeToInstant, formatLondon } from '../lib/time'

/**
 * Today's rota + live clock status per staff member, for the Team > Attendance
 * drill-down. Distinct from useTeamStatus (hub tile counts): this returns the
 * full roster — including staff who haven't clocked in yet or have already
 * clocked out — plus a late-arrivals list with manager acknowledgement.
 */
export function useAttendanceToday(venueId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const refresh = useCallback(() => setRefreshIndex(i => i + 1), [])

  useEffect(() => {
    if (!venueId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const todayStr = londonToday()
      const dayStartInstant = londonWallTimeToInstant(todayStr, '00:00:00')
      const dayStart = dayStartInstant.toISOString()
      const dayEnd   = new Date(dayStartInstant.getTime() + 86400000 - 1).toISOString()

      const [shiftsRes, clockRes] = await Promise.all([
        supabase.from('shifts')
          .select('id, staff_id, start_time, end_time, role_label, staff:staff_id(id, name, job_role)')
          .eq('venue_id', venueId)
          .eq('shift_date', todayStr)
          .order('start_time'),
        supabase.from('clock_events')
          .select('id, staff_id, event_type, occurred_at, acknowledged_at, acknowledged_by, alert_reason, acknowledger:acknowledged_by(name)')
          .eq('venue_id', venueId)
          .gte('occurred_at', dayStart)
          .lte('occurred_at', dayEnd)
          .order('occurred_at', { ascending: true }),
      ])

      if (cancelled) return

      const shifts = shiftsRes.data ?? []
      const events = clockRes.data ?? []

      const eventsByStaff = {}
      for (const ev of events) {
        if (!eventsByStaff[ev.staff_id]) eventsByStaff[ev.staff_id] = []
        eventsByStaff[ev.staff_id].push(ev)
      }

      const roster = shifts.map(sh => {
        const evts = eventsByStaff[sh.staff_id] ?? []
        let status = 'not_started'
        let clockInEvent = null
        for (const ev of evts) {
          if (ev.event_type === 'clock_in')    { status = 'clocked_in'; clockInEvent = ev }
          if (ev.event_type === 'break_start') status = 'on_break'
          if (ev.event_type === 'break_end')   status = 'clocked_in'
          if (ev.event_type === 'clock_out')   status = 'clocked_out'
        }

        let isLate = false, lateMins = 0
        if (clockInEvent) {
          const shiftStart = londonWallTimeToInstant(todayStr, sh.start_time)
          const actualIn = new Date(clockInEvent.occurred_at)
          if (actualIn > shiftStart) {
            isLate = true
            lateMins = Math.round((actualIn - shiftStart) / 60000)
          }
        }

        return {
          shiftId: sh.id,
          staffId: sh.staff_id,
          name: sh.staff?.name ?? 'Unknown',
          role: sh.role_label || sh.staff?.job_role || '',
          startTime: sh.start_time,
          endTime: sh.end_time,
          status,
          clockInTime: clockInEvent?.occurred_at ?? null,
          isLate,
          lateMins,
          lateEvent: isLate ? clockInEvent : null,
        }
      })

      const late = roster
        .filter(r => r.isLate)
        .map(r => ({
          staffId: r.staffId,
          shiftId: r.shiftId,
          name: r.name,
          scheduledTime: formatLondon(londonWallTimeToInstant(todayStr, r.startTime), 'HH:mm'),
          actualTime: formatLondon(new Date(r.clockInTime), 'HH:mm'),
          lateMins: r.lateMins,
          clockEventId: r.lateEvent?.id ?? null,
          acknowledgedAt: r.lateEvent?.acknowledged_at ?? null,
          acknowledgedByName: r.lateEvent?.acknowledger?.name ?? null,
        }))

      setData({ roster, late, dateStr: todayStr })
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [venueId, refreshIndex])

  const acknowledgeLate = useCallback(async (clockEventId, managerId) => {
    const { error } = await supabase.rpc('acknowledge_clock_alert', {
      p_clock_event_id:  clockEventId,
      p_manager_id:      managerId,
      p_is_disciplinary: false,
    })
    if (!error) refresh()
    return { error }
  }, [refresh])

  return { data, loading, refresh, acknowledgeLate }
}
