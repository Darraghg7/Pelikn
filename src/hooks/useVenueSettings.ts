import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface VenueSettingsData {
  venue_name: string
  manager_email: string
  logo_url: string
  // Venue's official FSA/FHRS (or Scotland FHIS) hygiene rating from its last
  // real EHO inspection — kept separate from mock_inspections (which holds
  // self-assessment scores) so the two can be shown side by side.
  fhrs_rating: number | null
  fhrs_rated_at: string | null
}

const EMPTY_SETTINGS: VenueSettingsData = { venue_name: '', manager_email: '', logo_url: '', fhrs_rating: null, fhrs_rated_at: null }

async function fetchVenueSettings(venueId: string): Promise<VenueSettingsData> {
  const { data, error } = await supabase.from('app_settings').select('key, value, venue_id').eq('venue_id', venueId)
  if (error) throw error
  if (!data) return EMPTY_SETTINGS
  const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
  return {
    venue_name:    map.venue_name    ?? '',
    manager_email: map.manager_email ?? '',
    logo_url:      map.logo_url      ?? '',
    fhrs_rating:   map.fhrs_rating   != null && map.fhrs_rating !== '' ? Number(map.fhrs_rating) : null,
    fhrs_rated_at: map.fhrs_rated_at || null,
  }
}

export default function useVenueSettings(): {
  settings: VenueSettingsData
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['venue-settings', venueId]

  const { data: settings, isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => fetchVenueSettings(venueId!),
    enabled: !!venueId,
    placeholderData: EMPTY_SETTINGS,
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return { settings: settings ?? EMPTY_SETTINGS, loading, reload }
}
