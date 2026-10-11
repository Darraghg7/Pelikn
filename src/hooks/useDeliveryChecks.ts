import { useQuery } from '@tanstack/react-query'
import { fetchDeliveryChecks, type DeliveryCheck } from '../lib/api/deliveries'

export default function useDeliveryChecks(venueId: string): {
  checks: DeliveryCheck[]
  loading: boolean
  isError: boolean
  reload: () => void
} {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['deliveryChecks', venueId],
    queryFn: () => fetchDeliveryChecks(venueId),
    enabled: !!venueId,
  })

  return { checks: data ?? [], loading: isLoading, isError, reload: refetch }
}
