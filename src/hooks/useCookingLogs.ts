/**
 * useCookingLogs — data hooks for cooking_temp_logs table.
 * UK legal minimum for cooking and reheating: ≥75°C (2-second hold).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const COOKING_TARGET_TEMP = 75  // °C — UK Food Safety (Temperature Control) Regs 1995

interface CookingLog {
  id: string
  food_item: string
  temperature: number
  target_temp: number
  check_type: string
  notes?: string
  logged_at: string
  logged_by_name?: string
  venue_id: string
}

/** Returns true when a cooking/reheating temp is a fail. */
export function isCookingTempFail(temperature: number | string, targetTemp = COOKING_TARGET_TEMP): boolean {
  return parseFloat(String(temperature)) < targetTemp
}

/**
 * useCookingLogs — fetches cooking_temp_logs filtered by type and optional date range.
 * @param checkType  — 'cooking' | 'reheating' | null (both)
 * @param dateFrom   — ISO date e.g. '2025-01-01'
 * @param dateTo     — ISO date e.g. '2025-01-31'
 */
export function useCookingLogs(checkType: string | null = null, dateFrom: string | null = null, dateTo: string | null = null): {
  logs: CookingLog[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['cooking_logs', venueId, checkType, dateFrom, dateTo]

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('cooking_temp_logs')
        .select('id, food_item, temperature, target_temp, check_type, notes, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .order('logged_at', { ascending: false })
        .limit(200)

      if (checkType) q = q.eq('check_type', checkType)
      if (dateFrom) q = q.gte('logged_at', `${dateFrom}T00:00:00`)
      if (dateTo)   q = q.lte('logged_at', `${dateTo}T23:59:59`)

      const { data, error } = await q
      if (error) return [] as CookingLog[]
      return (data ?? []) as CookingLog[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { logs, loading, reload }
}

/**
 * useTodayCookingLogs — fetches today's cooking logs for the dashboard summary.
 */
export function useTodayCookingLogs(): { logs: CookingLog[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['cooking_logs_today', venueId]

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('cooking_temp_logs')
        .select('id, food_item, temperature, target_temp, check_type, notes, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .order('logged_at', { ascending: false })
      return (data ?? []) as CookingLog[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { logs, loading, reload }
}
