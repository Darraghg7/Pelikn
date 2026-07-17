import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import {
  fetchRecallProcedure, fetchRecallLogs,
  type RecallProcedure, type RecallLog,
} from '../lib/api/recall'

export function useRecallProcedure(): { procedure: RecallProcedure | null; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['recallProcedure', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchRecallProcedure(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  return { procedure: data ?? null, loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}

export function useRecallLogs(): { logs: RecallLog[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['recallLogs', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchRecallLogs(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { logs: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
