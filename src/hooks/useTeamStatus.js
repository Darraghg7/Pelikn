import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { londonToday, londonWallTimeToInstant } from '../lib/time'
import { readPersisted, writePersisted } from '../lib/persistedCache'

// SWR cache — 30 s stale (clock status changes frequently). Backed by
// localStorage so a cold app open renders the last-known tiles immediately
// while a background refresh fires.
const _cache  = new Map()
const STALE_MS = 30_000
const FRESH_MS = 10_000

function cacheGet(key) {
  const entry = _cache.get(key)
  if (entry) return entry
  const persisted = readPersisted('team_status', key)
  if (persisted) {
    // Seed as just-past-fresh: shown immediately via the stale-hit path,
    // which also kicks off a background revalidation.
    const seeded = { data: persisted, ts: Date.now() - FRESH_MS - 1000 }
    _cache.set(key, seeded)
    return seeded
  }
  return null
}
function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() })
  writePersisted('team_status', key, data)
}

/**
 * Everything the Team hub reads, in one request (get_team_status, migration
 * 136) — it used to open with 10 at once, and a cold database slows down
 * with every extra request that arrives together. Falls back to the
 * per-table queries while 136 isn't applied, or if the call fails.
 */
let teamRpcMissing = false

async function fetchTeamRaw(venueId, today, todayStr, dayStart, dayEnd) {
  const weekFrom     = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekTo       = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const trainingTo   = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd')
  const rotaKey      = `rota_published_${weekFrom}`
  // "Upcoming" calendar events: the next 14 days, as the Calendar page counts them.
  const calendarFrom = new Date().toISOString().slice(0, 10)
  const calendarTo   = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  if (!teamRpcMissing) {
    const { data, error } = await supabase.rpc('get_team_status', {
      p_venue_id: venueId, p_day_start: dayStart, p_day_end: dayEnd, p_today: todayStr,
      p_training_until: trainingTo, p_week_from: weekFrom, p_week_to: weekTo,
      p_rota_key: rotaKey, p_calendar_from: calendarFrom, p_calendar_to: calendarTo,
    })
    if (!error && data) {
      return {
        allStaff:         data.staff ?? [],
        clockEvents:      data.clock_events ?? [],
        todayShifts:      data.today_shifts ?? [],
        pendingSwaps:     data.pending_swaps ?? 0,
        pendingTimeOff:   data.pending_time_off ?? 0,
        expiringTraining: data.expiring_training ?? 0,
        rotaUnfilled:     data.rota_unfilled ?? 0,
        rotaPublished:    !!data.rota_published,
        calendarUpcoming: data.calendar_upcoming ?? 0,
      }
    }
    if (error?.code === 'PGRST202') teamRpcMissing = true
  }

  const count = { count: 'exact', head: true }
  const [
    staffRes, clockRes, swapRes, timeOffRes, trainingRes, shiftsRes, unfilledRes, rotaPubRes, calendarRes,
  ] = await Promise.all([
    supabase.from('staff').select('id, name, role').eq('venue_id', venueId).eq('is_active', true),
    supabase.from('clock_events')
      .select('staff_id, event_type, occurred_at')
      .eq('venue_id', venueId)
      .gte('occurred_at', dayStart)
      .lte('occurred_at', dayEnd)
      .order('occurred_at', { ascending: true }),
    // Shift swaps pending approval
    supabase.from('shift_swaps').select('id', count).eq('venue_id', venueId).eq('status', 'pending'),
    // Time off pending
    supabase.from('time_off_requests').select('id', count).eq('venue_id', venueId).eq('status', 'pending'),
    // Training expiring soon (within 30 days) — staff_training.expiry_date is a DATE
    supabase.from('staff_training').select('id', count)
      .eq('venue_id', venueId)
      .lte('expiry_date', trainingTo)
      .gte('expiry_date', todayStr),
    // Today's shifts for attendance context
    supabase.from('shifts').select('id, staff_id, start_time, end_time').eq('venue_id', venueId).eq('shift_date', todayStr),
    // Unfilled shifts this week (no staff assigned)
    supabase.from('shifts').select('id', count)
      .eq('venue_id', venueId)
      .is('staff_id', null)
      .gte('shift_date', weekFrom)
      .lte('shift_date', weekTo),
    // Rota published status for this week
    supabase.from('app_settings').select('value').eq('venue_id', venueId).eq('key', rotaKey).maybeSingle(),
    supabase.from('manager_calendar_events').select('id', count)
      .eq('venue_id', venueId)
      .gte('start_date', calendarFrom)
      .lte('start_date', calendarTo),
  ])

  return {
    allStaff:         staffRes.data ?? [],
    clockEvents:      clockRes.data ?? [],
    todayShifts:      shiftsRes.data ?? [],
    pendingSwaps:     swapRes.count ?? 0,
    pendingTimeOff:   timeOffRes.count ?? 0,
    expiringTraining: trainingRes.count ?? 0,
    rotaUnfilled:     unfilledRes.count ?? 0,
    rotaPublished:    !!(rotaPubRes.data?.value),
    calendarUpcoming: calendarRes.count ?? 0,
  }
}

/**
 * Returns live attendance data + counts for the Team hub status grid.
 */
export function useTeamStatus(venueId) {
  const dateStr  = londonToday()
  const cacheKey = venueId ? `${venueId}:${dateStr}` : null
  const cached   = cacheKey ? cacheGet(cacheKey) : null

  const [data, setData]       = useState(cached?.data ?? null)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!venueId) return
    const key   = `${venueId}:${dateStr}`
    const entry = cacheGet(key)
    const age   = entry ? Date.now() - entry.ts : Infinity

    if (entry && age < FRESH_MS) {
      setData(entry.data); setLoading(false); return
    }
    if (entry && age < STALE_MS) {
      setData(entry.data); setLoading(false)
      // fall through to background refresh
    }

    let cancelled = false

    async function fetch() {
      if (!entry) setLoading(true)
      try {
      const today = new Date()
      // Anchor "today" to UK time so the window matches the cafés' day, not the
      // viewer's device timezone.
      const todayStr = londonToday()
      const dayStart = londonWallTimeToInstant(todayStr, '00:00:00').toISOString()
      const dayEnd   = new Date(londonWallTimeToInstant(todayStr, '00:00:00').getTime() + 86400000 - 1).toISOString()

      const raw = await fetchTeamRaw(venueId, today, todayStr, dayStart, dayEnd)

      if (cancelled) return

      const { allStaff, clockEvents, todayShifts } = raw

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
          // Scheduled start is UK wall-clock, independent of the viewer's device tz.
          const shiftStart = londonWallTimeToInstant(todayStr, shift.start_time)
          const actualIn   = new Date(clockInTime)
          isLate = actualIn > shiftStart
        }

        onShift.push({
          id: s.id,
          name: s.name,
          role: s.role ?? '',
          status: isLate ? 'late' : status === 'on_break' ? 'break' : 'on',
        })
      }

      const lateCount = onShift.filter(p => p.status === 'late').length

      const fresh = {
        onShift,
        totalStaff: allStaff.length,
        lateCount,
        pendingSwaps:    raw.pendingSwaps,
        pendingTimeOff:  raw.pendingTimeOff,
        expiringTraining: raw.expiringTraining,
        rotaUnfilled:    raw.rotaUnfilled,
        rotaPublished:   raw.rotaPublished,
        calendarUpcoming: raw.calendarUpcoming,
      }
      cacheSet(key, fresh)
      setData(fresh)
      setLoading(false)
      } catch {
        if (!entry) setLoading(false)
      }
    }

    fetch()
    // Live "on shift" refresh. Skipped while the app is backgrounded — each
    // tick is 8 queries against the shared database, for a screen nobody sees.
    const interval = setInterval(() => { if (!document.hidden) fetch() }, STALE_MS)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId])

  return { data, loading }
}
