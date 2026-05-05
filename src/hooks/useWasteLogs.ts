import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface WasteLog {
  id: string
  item_name: string
  quantity: number
  unit: string
  reason?: string
  recorded_at: string
  recorded_by_name?: string
  notes?: string
  venue_id: string
}

export function useWasteLogs(dateFrom: string | null, dateTo: string | null): {
  logs: WasteLog[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data: logs = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['waste_logs', venueId, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('waste_logs')
        .select('id, item_name, quantity, unit, reason, recorded_at, recorded_by_name, notes, venue_id')
        .eq('venue_id', venueId)
        .order('recorded_at', { ascending: false })
        .limit(500)

      if (dateFrom) q = q.gte('recorded_at', dateFrom)
      if (dateTo)   q = q.lte('recorded_at', dateTo + 'T23:59:59')

      const { data } = await q
      return (data ?? []) as WasteLog[]
    },
    enabled: !!venueId,
  })

  return { logs, loading, reload: refetch }
}
