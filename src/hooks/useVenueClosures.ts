import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useWidgetFetchGate } from './useWidgetFetchGate'

interface VenueClosure {
  id: string
  start_date: string
  end_date: string
  reason?: string
  venue_id: string
}

export default function useVenueClosures(): {
  closures: VenueClosure[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const gateOpen = useWidgetFetchGate()

  const { data: closures = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['venue_closures', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('venue_closures')
        .select('id, start_date, end_date, reason, venue_id')
        .eq('venue_id', venueId)
        .order('start_date')
      return (data ?? []) as VenueClosure[]
    },
    enabled: !!venueId && gateOpen,
  })

  return { closures, loading, reload: refetch }
}
