import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const COOLING_TARGET_TEMP = 8  // ≤8°C required by UK food safety regs

export const COOLING_METHODS = [
  { value: 'ambient',       label: 'Ambient (room temp)' },
  { value: 'ice_bath',      label: 'Ice bath' },
  { value: 'blast_chiller', label: 'Blast chiller' },
  { value: 'cold_water',    label: 'Cold running water' },
  { value: 'other',         label: 'Other' },
]

interface CoolingLog {
  id: string
  food_item: string
  start_temp: number
  end_temp: number
  cooling_method: string
  start_time: string
  end_time: string
  pass: boolean
  corrective_action?: string
  logged_at: string
  logged_by_name?: string
  venue_id: string
}

/** Returns true if the end temperature is above the safe threshold */
export function isCoolingTempFail(endTemp: number | string, targetTemp = COOLING_TARGET_TEMP): boolean {
  return Number(endTemp) > targetTemp
}

/** Filtered history hook — pass date strings 'yyyy-MM-dd' */
export function useCoolingLogs(dateFrom: string | null, dateTo: string | null): {
  logs: CoolingLog[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['cooling_logs', venueId, dateFrom, dateTo]

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('cooling_logs')
        .select('id, food_item, start_temp, end_temp, cooling_method, start_time, end_time, pass, corrective_action, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .order('logged_at', { ascending: false })
        .limit(200)

      if (dateFrom) q = q.gte('logged_at', dateFrom)
      if (dateTo)   q = q.lte('logged_at', dateTo + 'T23:59:59')

      const { data } = await q
      return (data ?? []) as CoolingLog[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { logs, loading, reload }
}

/** Today's logs only — for dashboard / summary */
export function useTodayCoolingLogs(): { logs: CoolingLog[]; loading: boolean } {
  const { venueId } = useVenue()

  const queryKey = ['cooling_logs_today', venueId]

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('cooling_logs')
        .select('id, food_item, start_temp, end_temp, cooling_method, start_time, end_time, pass, corrective_action, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .gte('logged_at', today)
        .order('logged_at', { ascending: false })
      return (data ?? []) as CoolingLog[]
    },
    enabled: !!venueId,
  })

  return { logs, loading }
}
