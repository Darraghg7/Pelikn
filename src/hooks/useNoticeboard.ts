import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchNotices, type Notice } from '../lib/api/noticeboard'

export function useNotices(): { notices: Notice[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['notices', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchNotices(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { notices: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
