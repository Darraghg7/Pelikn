import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchIncidents, type Incident } from '../lib/api/incidents'

export function useIncidents(): { incidents: Incident[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['incidents', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchIncidents(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { incidents: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
