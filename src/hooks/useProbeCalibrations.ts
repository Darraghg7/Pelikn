import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchProbeCalibrations } from '../lib/api/probe'

/** The venue's last 100 probe calibrations, newest first. */
export function useProbeCalibrations(): {
  records: Record<string, any>[]
  loading: boolean
  failed: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['probe_calibrations', venueId]

  const { data = [], isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchProbeCalibrations(venueId!),
    enabled: !!venueId,
  })

  return {
    records: data,
    loading: isLoading,
    failed: isError,
    reload: () => queryClient.invalidateQueries({ queryKey }),
  }
}
