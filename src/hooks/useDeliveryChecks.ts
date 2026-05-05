import { useQuery } from '@tanstack/react-query'
import { fetchDeliveryChecks } from '../lib/api/deliveries'

interface DeliveryCheck {
  id: string
  [key: string]: unknown
}

export default function useDeliveryChecks(venueId: string): {
  checks: DeliveryCheck[]
  loading: boolean
  reload: () => void
} {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['deliveryChecks', venueId],
    queryFn: () => fetchDeliveryChecks(venueId),
    enabled: !!venueId,
  })

  return { checks: (data ?? []) as DeliveryCheck[], loading: isLoading, reload: refetch }
}
