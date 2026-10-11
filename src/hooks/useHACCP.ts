import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchHACCPPlan, saveHACCPPlan, fetchHACCPSummary } from '../lib/api/haccp'

export function useHACCPPlan() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['haccp_plan', venueId]
  const { data: plan = null, isLoading: loading, isError: failed, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchHACCPPlan(venueId!),
    enabled: !!venueId,
  })
  const save = async (payload: Record<string, unknown>) => {
    await saveHACCPPlan(venueId!, plan?.id, payload)
    await queryClient.invalidateQueries({ queryKey })
  }
  return { plan, loading, failed, reload: () => refetch(), save }
}

/** The 30-day record counts, fetched when the manager asks for the summary (not on page load). */
export function useHACCPSummary() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  return () => queryClient.fetchQuery({
    queryKey: ['haccp_summary', venueId],
    queryFn: () => fetchHACCPSummary(venueId!),
    staleTime: 0,
  })
}
