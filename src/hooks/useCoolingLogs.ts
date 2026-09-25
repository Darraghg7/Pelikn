import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import type { CoolingLog } from '../lib/cooling'

export {
  COOLING_TARGET_TEMP, COOLING_TARGET_MINUTES, COOLING_METHODS,
  coolingMethodLabel, isCoolingTempFail, coolingMinutes, coolingOutcome, formatCoolingMinutes,
} from '../lib/cooling'
export type { CoolingLog } from '../lib/cooling'

// There is no stored pass flag — see coolingOutcome. The corrective action a
// failed cool needs is written to `notes`.
const COOLING_COLUMNS =
  'id, food_item, start_temp, end_temp, target_temp, cooling_method, started_at, finished_at, logged_at, logged_by, logged_by_name, notes, venue_id'
// Before migration 120 there is no finished_at column
const LEGACY_COOLING_COLUMNS =
  'id, food_item, start_temp, end_temp, target_temp, cooling_method, started_at, logged_at, logged_by, logged_by_name, notes, venue_id'

async function selectWithFallback(build: (columns: string) => PromiseLike<{ data: unknown; error: unknown }>): Promise<CoolingLog[]> {
  const { data, error } = await build(COOLING_COLUMNS)
  if (!error) return (data ?? []) as CoolingLog[]
  const { data: legacy } = await build(LEGACY_COOLING_COLUMNS)
  return (legacy ?? []) as CoolingLog[]
}

/** Finished batches between two local dates ('yyyy-MM-dd'), newest first. */
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
    queryFn: () => selectWithFallback((columns) => {
      let q = supabase
        .from('cooling_logs')
        .select(columns)
        .eq('venue_id', venueId)
        .not('end_temp', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1000)

      if (dateFrom) q = q.gte('started_at', new Date(`${dateFrom}T00:00:00`).toISOString())
      if (dateTo)   q = q.lte('started_at', new Date(`${dateTo}T23:59:59`).toISOString())
      return q
    }),
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey: ['cooling_logs', venueId] })

  return { logs, loading, reload }
}

/** Batches still cooling (no end temperature yet), oldest first. */
export function useCoolingInProgress(): { batches: CoolingLog[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['cooling_in_progress', venueId]

  const { data: batches = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => selectWithFallback((columns) => supabase
      .from('cooling_logs')
      .select(columns)
      .eq('venue_id', venueId)
      .is('end_temp', null)
      .order('started_at', { ascending: true })),
    enabled: !!venueId,
    refetchInterval: 60_000, // pick up batches started or finished on another device
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { batches, loading, reload }
}

/** Most-logged food items over the last 60 days, for quick-pick chips. */
export function useFrequentCoolingItems(limit = 4): string[] {
  const { venueId } = useVenue()

  const { data = [] } = useQuery({
    queryKey: ['cooling_frequent_items', venueId],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      const { data: rows } = await supabase
        .from('cooling_logs')
        .select('food_item')
        .eq('venue_id', venueId)
        .gte('started_at', since)
        .limit(500)
      const counts = new Map<string, { name: string; n: number }>()
      for (const row of (rows ?? []) as { food_item: string }[]) {
        const name = row.food_item?.trim()
        if (!name) continue
        const key = name.toLowerCase()
        const entry = counts.get(key) ?? { name, n: 0 }
        entry.n++
        counts.set(key, entry)
      }
      return [...counts.values()].sort((a, b) => b.n - a.n).map(e => e.name)
    },
    enabled: !!venueId,
    staleTime: 5 * 60_000,
  })

  return data.slice(0, limit)
}
