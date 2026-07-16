import { useQuery } from '@tanstack/react-query'
import { fetchDeliveryChecks, type DeliveryCheck } from '../lib/api/deliveries'

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

  return { checks: data ?? [], loading: isLoading, reload: refetch }
}
