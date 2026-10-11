import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import {
  fetchPPDSItems, fetchPPDSItem, setPPDSItemActive, deletePPDSItem, savePPDSItem,
  type PPDSItemInput,
} from '../lib/api/allergens'

export function usePPDSItems() {
  const { venueId } = useVenue()
  const { data: items = [], isLoading: loading, isError: failed, refetch } = useQuery({
    queryKey: ['ppds_items', venueId],
    queryFn: () => fetchPPDSItems(venueId!),
    enabled: !!venueId,
  })
  return { items, loading, failed, reload: () => refetch() }
}

/** One PPDS item: `item` is null once loaded when it doesn't exist; `failed` means the read itself failed. */
export function usePPDSItem(id: string | undefined) {
  const { venueId } = useVenue()
  const { data: item, isPending, isError: failed, refetch } = useQuery({
    queryKey: ['ppds_item', venueId, id],
    queryFn: () => fetchPPDSItem(venueId!, id as string),
    enabled: !!id && !!venueId,
  })
  return { item: item ?? null, loading: !!id && isPending && !failed, failed, reload: () => refetch() }
}

export function usePPDSActions() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['ppds_items', venueId] }),
    queryClient.invalidateQueries({ queryKey: ['ppds_item', venueId] }),
  ])
  return {
    setActive: async (id: string, isActive: boolean) => { await setPPDSItemActive(venueId!, id, isActive); void refresh() },
    remove:    async (id: string) => { await deletePPDSItem(venueId!, id); void refresh() },
    save:      async (id: string | undefined, input: PPDSItemInput) => { await savePPDSItem(venueId!, id, input); void refresh() },
  }
}
