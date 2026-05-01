import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { PERMISSION_PRESETS, PERMISSION_TITLES_SETTING_KEY } from '../lib/constants'

function parsePermissionTitles(value) {
  if (!value) return PERMISSION_PRESETS
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return PERMISSION_PRESETS
    return parsed
      .filter(p => p?.label && Array.isArray(p.permissions))
      .map((p, index) => ({
        id: p.id || `custom-${index}`,
        label: p.label,
        permissions: p.permissions,
      }))
  } catch {
    return PERMISSION_PRESETS
  }
}

export default function useVenueSettings() {
  const { venueId } = useVenue()
  const [settings, setSettings] = useState({ venue_name: '', manager_email: '', logo_url: '', permission_titles: PERMISSION_PRESETS })
  const [loading, setLoading]   = useState(true)
  const load = async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase.from('app_settings').select('key, value, venue_id').eq('venue_id', venueId)
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.key, r.value]))
      setSettings({
        venue_name:    map.venue_name    ?? '',
        manager_email: map.manager_email ?? '',
        logo_url:      map.logo_url      ?? '',
        permission_titles: parsePermissionTitles(map[PERMISSION_TITLES_SETTING_KEY]),
      })
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [venueId])
  return { settings, loading, reload: load }
}
