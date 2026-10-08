import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useWidgetFetchGate } from './useWidgetFetchGate'

export interface VenueClosure {
  id: string
  start_date: string
  end_date: string
  reason?: string
  venue_id: string
  /** Set when the closure belongs to a My Calendar event (migration 140). */
  calendar_event_id?: string | null
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
      const { data, error } = await supabase
        .from('venue_closures')
        .select('*')
        .eq('venue_id', venueId)
        .order('start_date')
      if (error) throw error
      return (data ?? []) as VenueClosure[]
    },
    enabled: !!venueId && gateOpen,
  })

  return { closures, loading, reload: refetch }
}
