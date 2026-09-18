import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface VenueSettingsData {
  venue_name: string
  manager_email: string
  logo_url: string
}

async function fetchVenueSettings(venueId: string): Promise<VenueSettingsData> {
  const { data } = await supabase.from('app_settings').select('key, value, venue_id').eq('venue_id', venueId)
  if (!data) return { venue_name: '', manager_email: '', logo_url: '' }
  const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
  return {
    venue_name:    map.venue_name    ?? '',
    manager_email: map.manager_email ?? '',
    logo_url:      map.logo_url      ?? '',
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
    placeholderData: { venue_name: '', manager_email: '', logo_url: '' },
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return { settings: settings ?? { venue_name: '', manager_email: '', logo_url: '' }, loading, reload }
}
