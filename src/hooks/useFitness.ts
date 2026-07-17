import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import {
  fetchDeclarations, fetchIllnessPolicy,
  type FitnessDeclaration, type IllnessPolicy,
} from '../lib/api/fitness'

export function useDeclarations(date: string): { declarations: FitnessDeclaration[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['fitnessDeclarations', venueId, date]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDeclarations(venueId!, date),
    enabled: !!venueId && !!date,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { declarations: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}

export function useIllnessPolicy(): { policy: IllnessPolicy | null; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['illnessPolicy', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchIllnessPolicy(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  return { policy: data ?? null, loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
