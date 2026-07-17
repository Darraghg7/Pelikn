import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchDateLabellingLogs, type DateLabellingLog } from '../lib/api/dateLabelling'

export function useDateLabellingLogs(): { logs: DateLabellingLog[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['dateLabellingLogs', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDateLabellingLogs(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { logs: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
