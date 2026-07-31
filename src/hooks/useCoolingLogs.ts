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
  target_temp: number
  cooling_method: string
  started_at: string
  logged_at: string
  logged_by_name?: string
  notes?: string
  venue_id: string
}

// Matches the cooling_logs table. There is no stored pass flag or end
// timestamp — pass is derived from end_temp vs target_temp (isCoolingTempFail),
// and the corrective action a failed cool needs is written to `notes`.
const COOLING_COLUMNS =
  'id, food_item, start_temp, end_temp, target_temp, cooling_method, started_at, logged_at, logged_by_name, notes, venue_id'

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
        .select(COOLING_COLUMNS)
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
        .select(COOLING_COLUMNS)
        .eq('venue_id', venueId)
        .gte('logged_at', today)
        .order('logged_at', { ascending: false })
      return (data ?? []) as CoolingLog[]
    },
    enabled: !!venueId,
  })

  return { logs, loading }
}
