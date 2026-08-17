import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays } from 'date-fns'
import { useVenue } from '../contexts/VenueContext'
import { fetchHRSummary, type HRSummaryData } from '../lib/api/hr'

/**
 * HR hub summary (active staff + formal actions + expiring docs). React
 * Query cached (60s) — replaces a raw Promise.all fired fresh on every
 * visit to /hr.
 */
export function useHRSummary() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  // Date-only granularity so the string is stable within a calendar day and
  // doesn't defeat the cache by changing the query key on every render.
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const in30 = addDays(new Date(), 30).toISOString().slice(0, 10)
  const queryKey = ['hr-summary', venueId, since90, in30]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchHRSummary(venueId!, since90, in30),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return {
    staff: (data as HRSummaryData | undefined)?.staff ?? [],
    formalActionStaffIds: (data as HRSummaryData | undefined)?.formalActionStaffIds ?? [],
    expiringDocs: (data as HRSummaryData | undefined)?.expiringDocs ?? [],
    loading: isLoading,
    reload,
  }
}
