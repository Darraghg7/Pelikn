/**
 * useClockSessions — fetches the last 7 days of clock events for a staff
 * member and groups them into completed / active sessions for display and
 * editing.
 *
 * Each session:
 *   { clockInId, clockInAt, clockOutId, clockOutAt, breakMinutes, date }
 *
 * breakMinutes is rounded to nearest whole minute from the actual break
 * events, ready to pre-fill the edit form.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { subDays, startOfDay } from 'date-fns'

export interface ClockSession {
  clockInId: string
  clockInAt: Date
  clockOutId: string | null
  clockOutAt: Date | null
  breakMinutes: number
  date: Date
}

export function useClockSessions(staffId: string): {
  sessions: ClockSession[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clockSessions', venueId, staffId],
    queryFn: async (): Promise<ClockSession[]> => {
      if (!staffId) return []

      const since = startOfDay(subDays(new Date(), 7)).toISOString()

      let q = supabase
        .from('clock_events')
        .select('id, event_type, occurred_at')
        .eq('staff_id', staffId)
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: true })
      if (venueId) q = q.eq('venue_id', venueId)

      const { data, error: err } = await q
      if (err) throw new Error(err.message)

      // Group events into sessions.
      // A new session starts at each clock_in event.
      type SessionAccumulator = ClockSession & { _breaks: number[]; _lastBreakStart: Date | null }
      const result: SessionAccumulator[] = []
      let current: SessionAccumulator | null = null

      for (const ev of data ?? []) {
        if (ev.event_type === 'clock_in') {
          // Start a new session
          current = {
            clockInId:    ev.id,
            clockInAt:    new Date(ev.occurred_at),
            clockOutId:   null,
            clockOutAt:   null,
            breakMinutes: 0,
            date:         new Date(ev.occurred_at),
            // internal accumulators
            _breaks: [],
            _lastBreakStart: null,
          }
          result.push(current)
        } else if (current) {
          if (ev.event_type === 'clock_out') {
            current.clockOutId  = ev.id
            current.clockOutAt  = new Date(ev.occurred_at)
            current = null  // session closed
          } else if (ev.event_type === 'break_start') {
            current._lastBreakStart = new Date(ev.occurred_at)
          } else if (ev.event_type === 'break_end' && current._lastBreakStart) {
            const ms = new Date(ev.occurred_at).getTime() - current._lastBreakStart.getTime()
            current._breaks.push(ms)
            current._lastBreakStart = null
          }
        }
      }

      // Calculate breakMinutes for each session and clean up internal fields
      const clean: ClockSession[] = result.map(({ _breaks, _lastBreakStart: _unused, ...s }) => ({
        ...s,
        breakMinutes: Math.round(_breaks.reduce((a: number, b: number) => a + b, 0) / 60000),
      }))

      // Most-recent first
      return clean.reverse()
    },
    enabled: !!staffId,
  })

  return { sessions: data ?? [], loading: isLoading, error: (error as Error | null)?.message ?? null, reload: refetch }
}
