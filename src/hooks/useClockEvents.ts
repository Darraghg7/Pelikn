import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { isNetworkError } from '../lib/offlineSupabase'
import { getQueue } from '../lib/offlineQueue'

/**
 * True if this staff member has a clock event still sitting in the offline
 * queue, not yet delivered to the server.
 *
 * Matters because a plain online status read can't see a write the server
 * hasn't received yet — it will legitimately come back "no active session"
 * and, left unchecked, overwrite the optimistic cache the queued write set,
 * silently flipping someone from "clocked in" back to "clocked out" on their
 * own device while the real write is still in flight.
 */
interface QueuedItem {
  type: string
  fnName?: string
  args?: { p_staff_id?: string }
}

function hasQueuedClockEvent(staffId: string): boolean {
  return (getQueue() as QueuedItem[]).some(item =>
    item.type === 'rpc' && item.fnName === 'record_clock_event' && item.args?.p_staff_id === staffId
  )
}

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
export function useClockStatus(staffId: string): ClockStatusData & { loading: boolean; isError: boolean; reload: () => void } {
  const { venueId } = useVenue()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clockStatus', venueId, staffId],
    queryFn: async (): Promise<ClockStatusData> => {
      if (!staffId) return { status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 }

      // A queued-but-undelivered clock event exists for this person — the
      // server genuinely doesn't know about it yet, so don't let a "clean"
      // read overwrite the optimistic status the queue write already set.
      // Trust the cache until the queue actually drains.
      if (hasQueuedClockEvent(staffId)) {
        const cached = loadClockStatusCache(staffId)
        if (cached) return cached
      }

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
      } catch (err) {
        // Only a genuine network/offline failure falls back to the cached status
        // (or an honest "unknown, assume out") — that's the offline-resilience
        // this hook exists for. Any other failure (RLS denial, bad query, 5xx)
        // must NOT be swallowed into a fabricated 'clocked_out': that's exactly
        // how a staff member who is actually clocked in loses their Clock Out
        // button with zero trace of why. Let react-query surface it as isError
        // instead — see useTimesheetData below, which surfaces for the same reason.
        if (isNetworkError(err)) {
          const cached = loadClockStatusCache(staffId)
          if (cached) return cached
          return { status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 }
        }
        throw err
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

  return { status, clockInAt, breakStartAt, totalBreakMs, loading: isLoading, isError, reload: refetch }
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
  error: Error | null
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['timesheetData', venueId, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('clock_events')
        .select('id, staff_id, event_type, occurred_at, staff:staff_id(name)')
        .gte('occurred_at', dateFrom)
        .lte('occurred_at', dateTo)
        .order('staff_id')
        .order('occurred_at')
        .limit(5000)
      if (venueId) q = q.eq('venue_id', venueId)

      const { data, error } = await q
      // Surface the failure instead of returning [] — a swallowed error is
      // indistinguishable from "no hours" and hides stale-build / RLS / network
      // problems from the user (they just see blank actual-hours tiles).
      if (error) throw error
      // PostgREST returns the to-one staff join as an object; the untyped client infers an array.
      return (data ?? []) as unknown as TimesheetRow[]
    },
    // Auto-fetch whenever the venue or date range changes; skip only when dates
    // are not yet chosen (e.g. custom period with no dates entered).
    enabled: !!venueId && !!dateFrom && !!dateTo,
  })

  return { rows: data ?? [], loading: isLoading, error: isError ? (error as Error) : null, reload: refetch }
}
