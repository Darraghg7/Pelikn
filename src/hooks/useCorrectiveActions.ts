import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchCorrectiveActions, type CorrectiveAction } from '../lib/api/corrective'

export function useCorrectiveActions(): { records: CorrectiveAction[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['correctiveActions', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchCorrectiveActions(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { records: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
