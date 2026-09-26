/**
 * useCookingLogs — data hooks for cooking_temp_logs table.
 * UK legal minimum for cooking and reheating: ≥75°C (2-second hold).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const COOKING_TARGET_TEMP = 75  // °C — UK Food Safety (Temperature Control) Regs 1995

export interface CookingLog {
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
        .limit(1000)

      if (checkType) q = q.eq('check_type', checkType)
      // Local-day bounds, so an early-morning reading isn't filed under yesterday
      if (dateFrom) q = q.gte('logged_at', new Date(`${dateFrom}T00:00:00`).toISOString())
      if (dateTo)   q = q.lte('logged_at', new Date(`${dateTo}T23:59:59`).toISOString())

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
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('cooking_temp_logs')
        .select('id, food_item, temperature, target_temp, check_type, notes, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .gte('logged_at', new Date(`${today}T00:00:00`).toISOString())
        .lte('logged_at', new Date(`${today}T23:59:59`).toISOString())
        .order('logged_at', { ascending: false })
      return (data ?? []) as CookingLog[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { logs, loading, reload }
}

/** Most-logged food items over the last 60 days, for quick-pick buttons. */
export function useFrequentCookingItems(limit = 4): string[] {
  const { venueId } = useVenue()

  const { data = [] } = useQuery({
    queryKey: ['cooking_frequent_items', venueId],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      const { data: rows } = await supabase
        .from('cooking_temp_logs')
        .select('food_item')
        .eq('venue_id', venueId)
        .gte('logged_at', since)
        .limit(500)
      const counts = new Map<string, { name: string; n: number }>()
      for (const row of (rows ?? []) as { food_item: string }[]) {
        const name = row.food_item?.trim()
        if (!name) continue
        const entry = counts.get(name.toLowerCase()) ?? { name, n: 0 }
        entry.n++
        counts.set(name.toLowerCase(), entry)
      }
      return [...counts.values()].sort((a, b) => b.n - a.n).map(e => e.name)
    },
    enabled: !!venueId,
    staleTime: 5 * 60_000,
  })

  return data.slice(0, limit)
}
