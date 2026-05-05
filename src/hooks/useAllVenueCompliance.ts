import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, addDays } from 'date-fns'

interface Venue {
  id: string
  [key: string]: unknown
}

interface VenueData {
  fridgeAM: boolean
  fridgePM: boolean
  cookingCount: number
  hotHoldingAM: boolean
  hotHoldingPM: boolean
  pendingTimeOff: unknown[]
  clockedInCount: number
}

type VenueStatus = 'gray' | 'red' | 'amber' | 'green'

interface VenueComplianceResult {
  venue: Venue
  data: VenueData | null
  status: VenueStatus
  loading: boolean
}

interface ComplianceAggregate {
  total: number
  critical: number
  attention: number
  allClear: number
  onShift: number
  decisions: number
}

function venueStatus(d: VenueData | null): VenueStatus {
  if (!d) return 'gray'
  if (!d.fridgeAM || !d.fridgePM || !d.hotHoldingAM || !d.hotHoldingPM) return 'red'
  if ((d.pendingTimeOff as unknown[]).length > 0) return 'amber'
  return 'green'
}

async function fetchVenueData(venueId: string): Promise<VenueData> {
  const today    = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const [
    { data: fridgeLogs },
    { data: cookingLogs },
    { data: hotLogs },
    { data: timeOffRows },
    { data: clockEvents },
  ] = await Promise.all([
    supabase.from('fridge_temperature_logs').select('check_period').eq('venue_id', venueId).gte('logged_at', today).lt('logged_at', tomorrow),
    supabase.from('cooking_temp_logs').select('id').eq('venue_id', venueId).gte('logged_at', today).lt('logged_at', tomorrow),
    supabase.from('hot_holding_logs').select('check_period').eq('venue_id', venueId).gte('logged_at', today).lt('logged_at', tomorrow),
    supabase.from('time_off_requests').select('id, start_date, end_date, reason, staff(name)').eq('venue_id', venueId).eq('status', 'pending'),
    supabase.from('clock_events').select('staff_id, event_type').eq('venue_id', venueId).gte('occurred_at', today).lt('occurred_at', tomorrow).order('occurred_at'),
  ])

  const sessions: Record<string, { status: string }> = {}
  for (const e of clockEvents ?? []) {
    const sid = (e as { staff_id: string; event_type: string }).staff_id
    if (!sessions[sid]) sessions[sid] = { status: 'out' }
    if ((e as { event_type: string }).event_type === 'clock_in')    sessions[sid].status = 'in'
    if ((e as { event_type: string }).event_type === 'clock_out')   sessions[sid].status = 'out'
    if ((e as { event_type: string }).event_type === 'break_start') sessions[sid].status = 'break'
    if ((e as { event_type: string }).event_type === 'break_end')   sessions[sid].status = 'in'
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

async function fetchAllVenueCompliance(venues: Venue[]): Promise<VenueComplianceResult[]> {
  const settled = await Promise.allSettled(venues.map(v => fetchVenueData(v.id)))
  return venues.map((venue, i) => {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      return { venue, data: result.value, status: venueStatus(result.value), loading: false }
    }
    return { venue, data: null, status: 'gray' as VenueStatus, loading: false }
  })
}

/**
 * Fetches compliance data for all venues in parallel.
 * Returns { results: [{venue, data, status, loading}], aggregate, loading }
 */
export function useAllVenueCompliance(venues: Venue[] | null | undefined): {
  results: VenueComplianceResult[]
  aggregate: ComplianceAggregate
  loading: boolean
} {
  const venueIds = (venues ?? []).map(v => v.id).join(',')

  const { data: results, isLoading: loading } = useQuery({
    queryKey: ['all-venue-compliance', venueIds],
    queryFn: () => fetchAllVenueCompliance(venues ?? []),
    enabled: !!(venues?.length),
    placeholderData: [],
  })

  const aggregate = useMemo((): ComplianceAggregate => {
    const r = results ?? []
    return {
      total:      r.length,
      critical:   r.filter(v => v.status === 'red').length,
      attention:  r.filter(v => v.status === 'amber').length,
      allClear:   r.filter(v => v.status === 'green').length,
      onShift:    r.reduce((sum, v) => sum + (v.data?.clockedInCount ?? 0), 0),
      decisions:  r.reduce((sum, v) => sum + ((v.data?.pendingTimeOff as unknown[])?.length ?? 0), 0),
    }
  }, [results])

  return { results: results ?? [], aggregate, loading }
}
