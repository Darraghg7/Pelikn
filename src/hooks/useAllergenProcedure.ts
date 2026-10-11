import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchAllergenProcedure, saveAllergenProcedure } from '../lib/api/allergens'

export function useAllergenProcedure() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['allergen_procedure', venueId]
  const { data: procedure = null, isLoading: loading, isError: failed, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchAllergenProcedure(venueId!),
    enabled: !!venueId,
  })
  const save = async (payload: Record<string, unknown>) => {
    await saveAllergenProcedure(venueId!, !!procedure, payload)
    await queryClient.invalidateQueries({ queryKey })
  }
  return { procedure, loading, failed, reload: () => refetch(), save }
}
