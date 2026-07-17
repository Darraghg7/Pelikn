import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchSuppliers, type Supplier } from '../lib/api/suppliers'

/**
 * Active suppliers for the current venue. React Query caches the list (60s)
 * and dedupes across the pages that use it (Suppliers, Supplier Orders,
 * Delivery Checks), replacing three separate useState/useEffect fetches of
 * the same table.
 */
export function useSuppliers(): { suppliers: Supplier[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['suppliers', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSuppliers(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })
  return { suppliers: data ?? [], loading: isLoading, reload }
}
