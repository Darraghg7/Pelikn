import { useState, useEffect } from 'react'
import { startOfDay, endOfDay, format } from 'date-fns'
import { supabase } from '../lib/supabase'

/**
 * Returns live attendance data + counts for the Team hub status grid.
 */
export function useTeamStatus(venueId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) return
    let cancelled = false

    async function fetch() {
      setLoading(true)
      const today = new Date()
      const dayStart = startOfDay(today).toISOString()
      const dayEnd   = endOfDay(today).toISOString()
      const todayStr = format(today, 'yyyy-MM-dd')

      const [
        staffRes, clockRes, swapRes, timeOffRes, trainingRes, shiftSwapRes,
      ] = await Promise.all([
        supabase.from('staff').select('id, name, role, station').eq('venue_id', venueId).eq('is_active', true),
        supabase.from('clock_events')
          .select('staff_id, event_type, occurred_at')
          .eq('venue_id', venueId)
          .gte('occurred_at', dayStart)
          .lte('occurred_at', dayEnd)
          .order('occurred_at', { ascending: true }),
        // Shift swaps pending approval
        supabase.from('shift_swaps')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
          .eq('status', 'pending'),
        // Time off pending
        supabase.from('time_off_requests')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
          .eq('status', 'pending'),
        // Training expiring soon (within 30 days)
        supabase.from('training_records')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
          .lte('expires_at', new Date(Date.now() + 30 * 86400000).toISOString())
          .gte('expires_at', today.toISOString()),
        // Today's shifts for attendance context
        supabase.from('shifts').select('id, staff_id, start_time, end_time').eq('venue_id', venueId).eq('shift_date', todayStr),
      ])

      if (cancelled) return

      const allStaff = staffRes.data ?? []
      const clockEvents = clockRes.data ?? []
      const todayShifts = shiftSwapRes.data ?? []

      // Derive each staff member's current clock status
      const latestByStaff = {}
      for (const ev of clockEvents) {
        if (!latestByStaff[ev.staff_id]) latestByStaff[ev.staff_id] = []
        latestByStaff[ev.staff_id].push(ev)
      }

      const onShift = []
      for (const s of allStaff) {
        const evts = latestByStaff[s.id] ?? []
        if (!evts.length) continue

        // Determine status from sequence of events
        let status = 'off'
        let clockInTime = null
        for (const ev of evts) {
          if (ev.event_type === 'clock_in')    { status = 'clocked_in'; clockInTime = ev.occurred_at }
          if (ev.event_type === 'break_start') { status = 'on_break' }
          if (ev.event_type === 'break_end')   { status = 'clocked_in' }
          if (ev.event_type === 'clock_out')   { status = 'off' }
        }

        if (status === 'off') continue

        // Check if late against today's shift
        const shift = todayShifts.find(sh => sh.staff_id === s.id)
        let isLate = false
        if (shift && clockInTime) {
          const shiftStart = new Date(`${todayStr}T${shift.start_time}`)
          const actualIn   = new Date(clockInTime)
          isLate = actualIn > shiftStart
        }

        onShift.push({
          id: s.id,
          name: s.name,
          role: s.role ?? '',
          station: s.station ?? '',
          status: isLate ? 'late' : status === 'on_break' ? 'break' : 'on',
        })
      }

      const lateCount = onShift.filter(p => p.status === 'late').length

      setData({
        onShift,
        totalStaff: allStaff.length,
        lateCount,
        pendingSwaps:    swapRes.count   ?? 0,
        pendingTimeOff:  timeOffRes.count ?? 0,
        expiringTraining: trainingRes.count ?? 0,
      })
      setLoading(false)
    }

    fetch()
    return () => { cancelled = true }
  }, [venueId])

  return { data, loading }
}
