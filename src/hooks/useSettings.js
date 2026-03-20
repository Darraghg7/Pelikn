import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

// Default roles — used when no custom_roles row exists in app_settings
const DEFAULT_ROLES = [
  { value: 'chef',            label: 'Chef',            color: 'bg-orange-100 text-orange-800' },
  { value: 'sous_chef',       label: 'Sous Chef',       color: 'bg-amber-100 text-amber-800' },
  { value: 'kitchen_porter',  label: 'Kitchen Porter',  color: 'bg-yellow-100 text-yellow-800' },
  { value: 'foh',             label: 'Front of House',  color: 'bg-blue-100 text-blue-800' },
  { value: 'bartender',       label: 'Bartender',       color: 'bg-purple-100 text-purple-800' },
  { value: 'barista',         label: 'Barista',         color: 'bg-teal-100 text-teal-800' },
  { value: 'supervisor',      label: 'Supervisor',      color: 'bg-indigo-100 text-indigo-800' },
  { value: 'manager',         label: 'Manager',         color: 'bg-rose-100 text-rose-800' },
]

// Palette for auto-assigning colours to new roles
const COLOR_PALETTE = [
  'bg-orange-100 text-orange-800',
  'bg-amber-100 text-amber-800',
  'bg-yellow-100 text-yellow-800',
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
  'bg-green-100 text-green-800',
  'bg-pink-100 text-pink-800',
  'bg-sky-100 text-sky-800',
  'bg-red-100 text-red-800',
  'bg-stone-100 text-stone-800',
]

/**
 * Shared hook for app-wide settings stored in `app_settings`.
 * Returns customRoles, closedDays and helpers to persist changes.
 */
export function useAppSettings() {
  const { venueId } = useVenue()
  const [customRoles, setCustomRoles] = useState(DEFAULT_ROLES)
  const [closedDays, setClosedDays]   = useState([])   // indices 0=Mon..6=Sun
  const [loading, setLoading]         = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('venue_id', venueId)
      .in('key', ['custom_roles', 'closed_days'])

    if (data) {
      for (const row of data) {
        try {
          const parsed = JSON.parse(row.value)
          if (row.key === 'custom_roles' && Array.isArray(parsed) && parsed.length > 0) {
            setCustomRoles(parsed)
          }
          if (row.key === 'closed_days' && Array.isArray(parsed)) {
            setClosedDays(parsed)
          }
        } catch { /* ignore bad JSON */ }
      }
    }
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  const saveCustomRoles = useCallback(async (roles) => {
    if (!venueId) return
    setCustomRoles(roles)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'custom_roles', value: JSON.stringify(roles) })
  }, [venueId])

  const saveClosedDays = useCallback(async (days) => {
    if (!venueId) return
    setClosedDays(days)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'closed_days', value: JSON.stringify(days) })
  }, [venueId])

  /** Pick the next unused colour from the palette */
  const nextColor = useCallback(() => {
    const used = new Set(customRoles.map(r => r.color))
    return COLOR_PALETTE.find(c => !used.has(c)) || COLOR_PALETTE[customRoles.length % COLOR_PALETTE.length]
  }, [customRoles])

  return { customRoles, closedDays, loading, saveCustomRoles, saveClosedDays, nextColor, reload: load }
}
