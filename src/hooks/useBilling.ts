import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchVenueBilling } from '../lib/api/billing'
import { billingAccess, staffLimit, type BillingAccess, type VenueBilling } from '../lib/billing'

export const billingQueryKey = (venueId: string | null) => ['venue-billing', venueId]

/**
 * The venue's billing state. Cheap and slow-changing, so it is cached for
 * five minutes; Plan & Billing calls reload() after any change.
 */
export default function useBilling(): {
  billing: VenueBilling | null
  access: BillingAccess
  staffLimit: number | null
  loading: boolean
  reload: () => Promise<void>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: billingQueryKey(venueId),
    queryFn: () => fetchVenueBilling(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60_000,
  })

  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey: billingQueryKey(venueId) }),
    [queryClient, venueId],
  )

  const billing = data ?? null
  const access = useMemo(() => billingAccess(billing), [billing])

  return { billing, access, staffLimit: staffLimit(billing), loading: isLoading, reload }
}
