import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface ShiftSwap {
  id: string
  venue_id: string
  status: string
  created_at: string
  shift?: unknown
  [key: string]: unknown
}

export function useShiftSwaps(): {
  swaps: ShiftSwap[]
  loading: boolean
  reload: () => void
  pendingCount: number
} {
  const { venueId } = useVenue()

  const { data: swaps = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['shift_swaps', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('shift_swaps')
        .select('*, shift:shift_id(*)')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
      return (data ?? []) as ShiftSwap[]
    },
    enabled: !!venueId,
  })

  const pendingCount = swaps.filter((s) => s.status === 'pending').length

  return { swaps, loading, reload: refetch, pendingCount }
}
