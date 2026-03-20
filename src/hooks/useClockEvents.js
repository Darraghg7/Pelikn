import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

/**
 * Returns the current clock status for a staff member.
 * Persists across logouts — queries the most recent events regardless of date.
 * Returns timer data so ClockPanel can show elapsed time.
 */
export function useClockStatus(staffId) {
  const { venueId } = useVenue()
  const [status, setStatus] = useState(null)   // 'clocked_out' | 'clocked_in' | 'on_break'
  const [clockInAt, setClockInAt] = useState(null)       // Date of last clock_in
  const [breakStartAt, setBreakStartAt] = useState(null)  // Date if currently on break
  const [totalBreakMs, setTotalBreakMs] = useState(0)     // completed break ms since clock_in
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (id) => {
    const sid = id ?? staffId
    if (!sid) return
    setLoading(true)

    // Get the most recent clock_in or clock_out to determine if there's an active session
    let q = supabase
      .from('clock_events')
      .select('event_type, occurred_at')
      .eq('staff_id', sid)
      .in('event_type', ['clock_in', 'clock_out'])
      .order('occurred_at', { ascending: false })
      .limit(1)
    if (venueId) q = q.eq('venue_id', venueId)

    const { data: lastBoundary } = await q

    const lastEvent = lastBoundary?.[0]

    if (!lastEvent || lastEvent.event_type === 'clock_out') {
      setStatus('clocked_out')
      setClockInAt(null)
      setBreakStartAt(null)
      setTotalBreakMs(0)
      setLoading(false)
      return
    }

    // Active session — fetch all events since that clock_in
    const clockInTime = new Date(lastEvent.occurred_at)
    setClockInAt(clockInTime)

    let sq = supabase
      .from('clock_events')
      .select('event_type, occurred_at')
      .eq('staff_id', sid)
      .gte('occurred_at', lastEvent.occurred_at)
      .order('occurred_at')
    if (venueId) sq = sq.eq('venue_id', venueId)

    const { data: sessionEvents } = await sq

    // Calculate break time and current status
    let breakMs = 0
    let lastBreakStart = null
    let currentStatus = 'clocked_in'

    for (const ev of sessionEvents ?? []) {
      if (ev.event_type === 'break_start') {
        lastBreakStart = new Date(ev.occurred_at)
        currentStatus = 'on_break'
      } else if (ev.event_type === 'break_end' && lastBreakStart) {
        breakMs += new Date(ev.occurred_at) - lastBreakStart
        lastBreakStart = null
        currentStatus = 'clocked_in'
      }
    }

    setStatus(currentStatus)
    setTotalBreakMs(breakMs)
    setBreakStartAt(currentStatus === 'on_break' ? lastBreakStart : null)
    setLoading(false)
  }, [venueId, staffId])

  useEffect(() => { load() }, [load])

  return { status, clockInAt, breakStartAt, totalBreakMs, loading, reload: load }
}

export function useTimesheetData(staffIds, dateFrom, dateTo) {
  const { venueId } = useVenue()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    let q = supabase
      .from('clock_events')
      .select('staff_id, event_type, occurred_at, staff(name)')
      .gte('occurred_at', dateFrom)
      .lte('occurred_at', dateTo)
      .order('staff_id')
      .order('occurred_at')
    if (venueId) q = q.eq('venue_id', venueId)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }, [venueId, dateFrom, dateTo])

  return { rows, loading, reload: load }
}
