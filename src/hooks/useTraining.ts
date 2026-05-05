import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface TrainingRecord {
  id: string
  title: string
  provider?: string
  expiry_date?: string
  certificate_url?: string
  staff_id: string
  venue_id: string
  created_at: string
}

export function useStaffTraining(staffId: string): {
  records: TrainingRecord[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staffTraining', venueId, staffId],
    queryFn: async () => {
      if (!staffId) return [] as TrainingRecord[]
      let q = supabase
        .from('staff_training')
        .select('id, title, provider, expiry_date, certificate_url, staff_id, venue_id, created_at')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false })
      if (venueId) q = q.eq('venue_id', venueId)
      const { data } = await q
      return (data ?? []) as TrainingRecord[]
    },
    enabled: !!staffId,
  })

  return { records: data ?? [], loading: isLoading, reload: refetch }
}
