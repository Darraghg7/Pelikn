import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, addDays } from 'date-fns'

interface VenueComplianceData {
  fridgeAM: boolean
  fridgePM: boolean
  cookingCount: number
  hotHoldingAM: boolean
  hotHoldingPM: boolean
  pendingTimeOff: unknown[]
  clockedInCount: number
}

async function fetchVenueCompliance(venueId: string): Promise<VenueComplianceData> {
  const today    = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const [
    { data: fridgeLogs },
    { data: cookingLogs },
    { data: hotLogs },
    { data: timeOffRows },
    { data: clockEvents },
  ] = await Promise.all([
    supabase
      .from('fridge_temperature_logs')
      .select('check_period')
      .eq('venue_id', venueId)
      .gte('logged_at', today)
      .lt('logged_at', tomorrow),

    supabase
      .from('cooking_temp_logs')
      .select('id', { count: 'exact', head: false })
      .eq('venue_id', venueId)
      .gte('logged_at', today)
      .lt('logged_at', tomorrow),

    supabase
      .from('hot_holding_logs')
      .select('check_period')
      .eq('venue_id', venueId)
      .gte('logged_at', today)
      .lt('logged_at', tomorrow),

    supabase
      .from('time_off_requests')
      .select('id, start_date, end_date, reason, staff(name)')
      .eq('venue_id', venueId)
      .eq('status', 'pending'),

    supabase
      .from('clock_events')
      .select('staff_id, event_type, occurred_at')
      .eq('venue_id', venueId)
      .gte('occurred_at', today)
      .lt('occurred_at', tomorrow)
      .order('occurred_at'),
  ])

  // Derive currently clocked-in staff from today's events
  const sessions: Record<string, { status: string }> = {}
  for (const e of (clockEvents ?? []) as { staff_id: string; event_type: string }[]) {
    const sid = e.staff_id
    if (!sessions[sid]) sessions[sid] = { status: 'out' }
    if (e.event_type === 'clock_in')    sessions[sid].status = 'in'
    if (e.event_type === 'clock_out')   sessions[sid].status = 'out'
    if (e.event_type === 'break_start') sessions[sid].status = 'break'
    if (e.event_type === 'break_end')   sessions[sid].status = 'in'
  }
  const clockedInCount = Object.values(sessions).filter(s => s.status === 'in' || s.status === 'break').length

  const logs = (fridgeLogs ?? []) as { check_period: string }[]
  const hot  = (hotLogs ?? []) as { check_period: string }[]

  return {
    fridgeAM:       logs.some(l => l.check_period === 'am'),
    fridgePM:       logs.some(l => l.check_period === 'pm'),
    cookingCount:   (cookingLogs ?? []).length,
    hotHoldingAM:   hot.some(l => l.check_period === 'am'),
    hotHoldingPM:   hot.some(l => l.check_period === 'pm'),
    pendingTimeOff: timeOffRows ?? [],
    clockedInCount,
  }
}

/**
 * Fetches today's compliance snapshot for a given venue.
 * Used by the multi-venue overview dashboard.
 *
 * Returns:
 *   data.fridgeAM        — true if at least one AM fridge log exists today
 *   data.fridgePM        — true if at least one PM fridge log exists today
 *   data.cookingCount    — number of cooking temp logs today
 *   data.hotHoldingAM    — true if an AM hot holding check exists today
 *   data.hotHoldingPM    — true if a PM hot holding check exists today
 *   data.pendingTimeOff  — array of pending time_off_requests rows (with staff name)
 *   data.clockedInCount  — number of staff currently clocked in
 *   loading
 */
export function useVenueComplianceData(venueId: string): {
  data: VenueComplianceData | null
  loading: boolean
} {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['venue-compliance-data', venueId],
    queryFn: () => fetchVenueCompliance(venueId),
    enabled: !!venueId,
  })

  return { data: data ?? null, loading }
}
