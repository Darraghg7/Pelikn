import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchComplaints, type Complaint } from '../lib/api/complaints'

export function useComplaints(): { complaints: Complaint[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['complaints', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchComplaints(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { complaints: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
