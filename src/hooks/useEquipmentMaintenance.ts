import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchEquipmentLogs, type EquipmentLog } from '../lib/api/equipment'

export function useEquipmentLogs(): { logs: EquipmentLog[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['equipmentLogs', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchEquipmentLogs(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { logs: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}
