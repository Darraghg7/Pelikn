import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

// ── Clock status cache (localStorage) ────────────────────────────────────────
// Keeps the last known status so the app works offline without crashing.

const cacheKey = (staffId) => `ss_clock_${staffId}`

export function saveClockStatusCache(staffId, { status, clockInAt, breakStartAt, totalBreakMs }) {
  try {
    localStorage.setItem(cacheKey(staffId), JSON.stringify({
      status,
      clockInAt:    clockInAt?.toISOString()    ?? null,
      breakStartAt: breakStartAt?.toISOString() ?? null,
      totalBreakMs: totalBreakMs ?? 0,
    }))
  } catch { /* storage unavailable */ }
}

function loadClockStatusCache(staffId) {
  try {
    const raw = localStorage.getItem(cacheKey(staffId))
    if (!raw) return null
    const d = JSON.parse(raw)
    return {
      status:       d.status ?? 'clocked_out',
      clockInAt:    d.clockInAt    ? new Date(d.clockInAt)    : null,
      breakStartAt: d.breakStartAt ? new Date(d.breakStartAt) : null,
      totalBreakMs: d.totalBreakMs ?? 0,
    }
  } catch { return null }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the current clock status for a staff member.
 * Persists across logouts — queries the most recent events regardless of date.
 * Falls back to localStorage cache when offline so the app never crashes.
 */
export function useClockStatus(staffId) {
  const { venueId } = useVenue()
  const [status, setStatus]           = useState('clocked_out')
  const [clockInAt, setClockInAt]     = useState(null)
  const [breakStartAt, setBreakStartAt] = useState(null)
  const [totalBreakMs, setTotalBreakMs] = useState(0)
  const [loading, setLoading]         = useState(true)

  const applyState = useCallback((s, ci, bs, bm) => {
    setStatus(s)
    setClockInAt(ci)
    setBreakStartAt(bs)
    setTotalBreakMs(bm)
  }, [])

  const load = useCallback(async (id) => {
    const sid = id ?? staffId
    if (!sid) { setLoading(false); return }
    setLoading(true)

    try {
      // Get the most recent clock_in or clock_out to determine if there's an active session
      let q = supabase
        .from('clock_events')
        .select('event_type, occurred_at')
        .eq('staff_id', sid)
        .in('event_type', ['clock_in', 'clock_out'])
        .order('occurred_at', { ascending: false })
        .limit(1)
      if (venueId) q = q.eq('venue_id', venueId)

      const { data: lastBoundary, error: e1 } = await q
      if (e1) throw e1

      const lastEvent = lastBoundary?.[0]

      if (!lastEvent || lastEvent.event_type === 'clock_out') {
        applyState('clocked_out', null, null, 0)
        saveClockStatusCache(sid, { status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 })
        return
      }

      // Active session — fetch all events since that clock_in
      const clockInTime = new Date(lastEvent.occurred_at)

      let sq = supabase
        .from('clock_events')
        .select('event_type, occurred_at')
        .eq('staff_id', sid)
        .gte('occurred_at', lastEvent.occurred_at)
        .order('occurred_at')
      if (venueId) sq = sq.eq('venue_id', venueId)

      const { data: sessionEvents, error: e2 } = await sq
      if (e2) throw e2

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

      const bs = currentStatus === 'on_break' ? lastBreakStart : null
      applyState(currentStatus, clockInTime, bs, breakMs)
      saveClockStatusCache(sid, { status: currentStatus, clockInAt: clockInTime, breakStartAt: bs, totalBreakMs: breakMs })

    } catch {
      // Network error — use cached status so the app doesn't crash
      const cached = loadClockStatusCache(sid)
      if (cached) {
        applyState(cached.status, cached.clockInAt, cached.breakStartAt, cached.totalBreakMs)
      } else {
        applyState('clocked_out', null, null, 0)
      }
    } finally {
      setLoading(false)
    }
  }, [venueId, staffId, applyState])

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
