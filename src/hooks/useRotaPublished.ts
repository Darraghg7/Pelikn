import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useVenue } from '../contexts/VenueContext'
import { fetchRotaPublished } from '../lib/api/shifts'

/**
 * Whether the week has ever been published. `published` is null while it is
 * unknown (loading, or the read failed) so the rota never shows a false
 * "never published" warning. `markPublished` updates it straight after a publish.
 */
export function useRotaPublished(weekStart: Date): { published: boolean | null; markPublished: () => void; isError: boolean } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const queryKey = ['rota_published', venueId, weekStartStr]

  const { data, isError } = useQuery({
    queryKey,
    queryFn: () => fetchRotaPublished(venueId!, weekStartStr),
    enabled: !!venueId,
  })

  const markPublished = useCallback(
    () => queryClient.setQueryData(['rota_published', venueId, weekStartStr], new Date().toISOString()),
    [queryClient, venueId, weekStartStr],
  )

  return { published: data === undefined ? null : !!data, markPublished, isError }
}
