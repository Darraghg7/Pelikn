import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { PERMISSION_PRESETS, PERMISSION_TITLES_SETTING_KEY } from '../lib/constants'
import type { PermissionPreset } from '../types'

function parsePermissionTitles(value: string | undefined): PermissionPreset[] {
  if (!value) return PERMISSION_PRESETS as PermissionPreset[]
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return PERMISSION_PRESETS as PermissionPreset[]
    return parsed
      .filter((p: unknown) => (p as PermissionPreset)?.label && Array.isArray((p as PermissionPreset).permissions))
      .map((p: PermissionPreset, index: number) => ({
        id: p.id || `custom-${index}`,
        label: p.label,
        permissions: p.permissions,
      }))
  } catch {
    return PERMISSION_PRESETS as PermissionPreset[]
  }
}

interface VenueSettingsData {
  venue_name: string
  manager_email: string
  logo_url: string
  permission_titles: PermissionPreset[]
}

async function fetchVenueSettings(venueId: string): Promise<VenueSettingsData> {
  const { data } = await supabase.from('app_settings').select('key, value, venue_id').eq('venue_id', venueId)
  if (!data) return { venue_name: '', manager_email: '', logo_url: '', permission_titles: PERMISSION_PRESETS as PermissionPreset[] }
  const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
  return {
    venue_name:    map.venue_name    ?? '',
    manager_email: map.manager_email ?? '',
    logo_url:      map.logo_url      ?? '',
    permission_titles: parsePermissionTitles(map[PERMISSION_TITLES_SETTING_KEY]),
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
    placeholderData: { venue_name: '', manager_email: '', logo_url: '', permission_titles: PERMISSION_PRESETS as PermissionPreset[] },
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return { settings: settings ?? { venue_name: '', manager_email: '', logo_url: '', permission_titles: PERMISSION_PRESETS as PermissionPreset[] }, loading, reload }
}
