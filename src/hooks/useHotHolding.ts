/**
 * useHotHolding — data hooks for hot_holding_items and hot_holding_logs.
 * UK Food Safety regulations: hot food held for service must be ≥63°C.
 * Venues should check twice daily: AM and PM.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { isCheckRequired } from '../lib/temperatureChecks'

export const HOT_HOLDING_MIN_TEMP = 63  // °C — UK Food Safety (Temperature Control) Regs 1995
const HOT_HOLDING_ITEM_COLUMNS = 'id, name, is_active, venue_id, min_temp, max_temp, check_days, required_periods'
const LEGACY_HOT_HOLDING_ITEM_COLUMNS = 'id, name, is_active, venue_id'

interface HotHoldingItem {
  id: string
  name: string
  is_active: boolean
  venue_id: string
  min_temp: number
  max_temp: number | null
  check_days: number[]
  required_periods: string[]
}

interface HotHoldingLog {
  id: string
  item_id: string
  item_name?: string
  temperature: number
  check_period: 'am' | 'pm'
  logged_at: string
  logged_by_name?: string
  venue_id: string
  hot_holding_items?: { min_temp: number; max_temp: number | null } | null
}

interface HotHoldingTodayStatus {
  am: boolean
  pm: boolean
  amRequired: boolean
  pmRequired: boolean
  amLogs: HotHoldingLog[]
  pmLogs: HotHoldingLog[]
  amMissing: HotHoldingItem[]
  pmMissing: HotHoldingItem[]
}

function withHotHoldingDefaults(item: Partial<HotHoldingItem>): HotHoldingItem {
  return {
    ...(item as HotHoldingItem),
    min_temp: item.min_temp ?? HOT_HOLDING_MIN_TEMP,
    max_temp: item.max_temp ?? null,
    check_days: item.check_days ?? [0, 1, 2, 3, 4, 5, 6],
    required_periods: item.required_periods ?? ['am', 'pm'],
  }
}

async function fetchActiveHotHoldingItems(venueId: string): Promise<HotHoldingItem[]> {
  const { data, error } = await supabase
    .from('hot_holding_items')
    .select(HOT_HOLDING_ITEM_COLUMNS)
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('name')

  if (!error) return (data ?? []).map(withHotHoldingDefaults)

  const { data: legacyData } = await supabase
    .from('hot_holding_items')
    .select(LEGACY_HOT_HOLDING_ITEM_COLUMNS)
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('name')

  return (legacyData ?? []).map(withHotHoldingDefaults)
}

/** Returns true when a hot holding temp is a fail. */
export function isHotHoldingFail(temperature: number | string, item: HotHoldingItem | null = null): boolean {
  const value = parseFloat(String(temperature))
  const min = item?.min_temp ?? HOT_HOLDING_MIN_TEMP
  const max = item?.max_temp ?? null
  return value < min || (max !== null && max !== undefined && value > max)
}

/**
 * useHotHoldingItems — fetches all active hot holding items for this venue.
 * Managers can add/remove items; staff log readings against them.
 */
export function useHotHoldingItems(): { items: HotHoldingItem[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['hot_holding_items', venueId]

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => fetchActiveHotHoldingItems(venueId!),
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { items, loading, reload }
}

/**
 * useHotHoldingTodayStatus — returns which check periods have been completed today.
 * Returns { am: bool, pm: bool, amLogs: [...], pmLogs: [...] }
 */
export function useHotHoldingTodayStatus(): { status: HotHoldingTodayStatus; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['hot_holding_today_status', venueId]

  const defaultStatus: HotHoldingTodayStatus = { am: false, pm: false, amLogs: [], pmLogs: [], amRequired: false, pmRequired: false, amMissing: [], pmMissing: [] }

  const { data: status = defaultStatus, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async (): Promise<HotHoldingTodayStatus> => {
      const today = new Date().toISOString().slice(0, 10)
      const [items, { data }] = await Promise.all([
        fetchActiveHotHoldingItems(venueId!),
        supabase
          .from('hot_holding_logs')
          .select('id, item_id, temperature, check_period, logged_at, logged_by_name, venue_id')
          .eq('venue_id', venueId)
          .gte('logged_at', `${today}T00:00:00`)
          .lte('logged_at', `${today}T23:59:59`)
          .order('logged_at', { ascending: false }),
      ])

      const logs = (data ?? []) as HotHoldingLog[]
      const amLogs = logs.filter(l => l.check_period === 'am')
      const pmLogs = logs.filter(l => l.check_period === 'pm')
      const todayItems = items ?? []
      const requiredAmItems = todayItems.filter(item => isCheckRequired(item, new Date(), 'am'))
      const requiredPmItems = todayItems.filter(item => isCheckRequired(item, new Date(), 'pm'))
      const amLoggedItems = new Set(amLogs.map(log => log.item_id))
      const pmLoggedItems = new Set(pmLogs.map(log => log.item_id))
      const amMissing = requiredAmItems.filter(item => !amLoggedItems.has(item.id))
      const pmMissing = requiredPmItems.filter(item => !pmLoggedItems.has(item.id))
      return {
        am: requiredAmItems.length > 0 && amMissing.length === 0,
        pm: requiredPmItems.length > 0 && pmMissing.length === 0,
        amRequired: requiredAmItems.length > 0,
        pmRequired: requiredPmItems.length > 0,
        amLogs,
        pmLogs,
        amMissing,
        pmMissing,
      }
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { status, loading, reload }
}

/**
 * useHotHoldingLogs — fetches hot_holding_logs with optional date range filter.
 * @param dateFrom  — ISO date e.g. '2025-01-01'
 * @param dateTo    — ISO date e.g. '2025-01-31'
 */
export function useHotHoldingLogs(dateFrom: string | null = null, dateTo: string | null = null): {
  logs: HotHoldingLog[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['hot_holding_logs', venueId, dateFrom, dateTo]

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('hot_holding_logs')
        .select('id, item_id, item_name, temperature, check_period, logged_at, logged_by_name, venue_id, hot_holding_items(min_temp, max_temp)')
        .eq('venue_id', venueId)
        .order('logged_at', { ascending: false })
        .limit(300)

      if (dateFrom) q = q.gte('logged_at', `${dateFrom}T00:00:00`)
      if (dateTo)   q = q.lte('logged_at', `${dateTo}T23:59:59`)

      const { data, error } = await q
      // PostgREST returns the to-one join as an object; the untyped client infers an array.
      if (!error) return (data ?? []) as unknown as HotHoldingLog[]

      // Legacy fallback without join
      let fallback = supabase
        .from('hot_holding_logs')
        .select('id, item_id, item_name, temperature, check_period, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .order('logged_at', { ascending: false })
        .limit(300)

      if (dateFrom) fallback = fallback.gte('logged_at', `${dateFrom}T00:00:00`)
      if (dateTo)   fallback = fallback.lte('logged_at', `${dateTo}T23:59:59`)

      const { data: fallbackData } = await fallback
      return (fallbackData ?? []) as HotHoldingLog[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { logs, loading, reload }
}
