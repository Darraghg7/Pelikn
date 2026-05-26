import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

// ── Clock status cache (localStorage) ────────────────────────────────────────
// Keeps the last known status so the app works offline without crashing.

const cacheKey = (staffId: string) => `ss_clock_${staffId}`

type ClockStatus = 'clocked_out' | 'clocked_in' | 'on_break'

interface ClockStatusData {
  status: ClockStatus
  clockInAt: Date | null
  breakStartAt: Date | null
  totalBreakMs: number
}

export function saveClockStatusCache(staffId: string, { status, clockInAt, breakStartAt, totalBreakMs }: ClockStatusData): void {
  try {
    localStorage.setItem(cacheKey(staffId), JSON.stringify({
      status,
      clockInAt:    clockInAt?.toISOString()    ?? null,
      breakStartAt: breakStartAt?.toISOString() ?? null,
      totalBreakMs: totalBreakMs ?? 0,
    }))
  } catch { /* storage unavailable */ }
}

function loadClockStatusCache(staffId: string): ClockStatusData | null {
  try {
    const raw = localStorage.getItem(cacheKey(staffId))
    if (!raw) return null
    const d = JSON.parse(raw)
    return {
      status:       (d.status ?? 'clocked_out') as ClockStatus,
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
export function useClockStatus(staffId: string): ClockStatusData & { loading: boolean; reload: () => void } {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clockStatus', venueId, staffId],
    queryFn: async (): Promise<ClockStatusData> => {
      if (!staffId) return { status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 }

      try {
        // Get the most recent clock_in or clock_out to determine if there's an active session
        let q = supabase
          .from('clock_events')
          .select('event_type, occurred_at')
          .eq('staff_id', staffId)
          .in('event_type', ['clock_in', 'clock_out'])
          .order('occurred_at', { ascending: false })
          .limit(1)
        if (venueId) q = q.eq('venue_id', venueId)

        const { data: lastBoundary, error: e1 } = await q
        if (e1) throw e1

        const lastEvent = lastBoundary?.[0]

        if (!lastEvent || lastEvent.event_type === 'clock_out') {
          const result: ClockStatusData = { status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 }
          saveClockStatusCache(staffId, result)
          return result
        }

        // Active session — fetch all events since that clock_in
        const clockInTime = new Date(lastEvent.occurred_at)

        let sq = supabase
          .from('clock_events')
          .select('event_type, occurred_at')
          .eq('staff_id', staffId)
          .gte('occurred_at', lastEvent.occurred_at)
          .order('occurred_at')
        if (venueId) sq = sq.eq('venue_id', venueId)

        const { data: sessionEvents, error: e2 } = await sq
        if (e2) throw e2

        // Calculate break time and current status
        let breakMs = 0
        let lastBreakStart: Date | null = null
        let currentStatus: ClockStatus = 'clocked_in'

        for (const ev of sessionEvents ?? []) {
          if (ev.event_type === 'break_start') {
            lastBreakStart = new Date(ev.occurred_at)
            currentStatus = 'on_break'
          } else if (ev.event_type === 'break_end' && lastBreakStart) {
            breakMs += new Date(ev.occurred_at).getTime() - lastBreakStart.getTime()
            lastBreakStart = null
            currentStatus = 'clocked_in'
          }
        }

        const bs = currentStatus === 'on_break' ? lastBreakStart : null
        const result: ClockStatusData = { status: currentStatus, clockInAt: clockInTime, breakStartAt: bs, totalBreakMs: breakMs }
        saveClockStatusCache(staffId, result)
        return result
      } catch {
        // Network error — use cached status so the app doesn't crash
        const cached = loadClockStatusCache(staffId)
        if (cached) return cached
        return { status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 }
      }
    },
    enabled: !!staffId,
    placeholderData: () => {
      if (!staffId) return undefined
      return loadClockStatusCache(staffId) ?? undefined
    },
  })

  const status       = data?.status       ?? 'clocked_out'
  const clockInAt    = data?.clockInAt    ?? null
  const breakStartAt = data?.breakStartAt ?? null
  const totalBreakMs = data?.totalBreakMs ?? 0

  return { status, clockInAt, breakStartAt, totalBreakMs, loading: isLoading, reload: refetch }
}

interface TimesheetRow {
  id: string
  staff_id: string
  event_type: string
  occurred_at: string
  staff?: { name: string } | null
}

export function useTimesheetData(dateFrom: string, dateTo: string): {
  rows: TimesheetRow[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['timesheetData', venueId, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('clock_events')
        .select('id, staff_id, event_type, occurred_at, staff(name)')
        .gte('occurred_at', dateFrom)
        .lte('occurred_at', dateTo)
        .order('staff_id')
        .order('occurred_at')
        .limit(5000)
      if (venueId) q = q.eq('venue_id', venueId)

      const { data } = await q
      return (data ?? []) as TimesheetRow[]
    },
    // Auto-fetch whenever the venue or date range changes; skip only when dates
    // are not yet chosen (e.g. custom period with no dates entered).
    enabled: !!venueId && !!dateFrom && !!dateTo,
  })

  return { rows: data ?? [], loading: isLoading, reload: refetch }
}
