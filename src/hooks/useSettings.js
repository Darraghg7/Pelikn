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
 * Returns customRoles, closedDays, breakDurationMins and helpers to persist changes.
 */
export function useAppSettings() {
  const { venueId } = useVenue()
  const [customRoles, setCustomRoles]           = useState(DEFAULT_ROLES)
  const [closedDays, setClosedDays]             = useState([])   // indices 0=Mon..6=Sun
  const [breakDurationMins, setBreakDurationMins] = useState(30) // unpaid break for adults >6h
  const [cleanupMinutes, setCleanupMinutes]     = useState(0)   // grace period after shift end
  const [fridgeCheckTime, setFridgeCheckTime]   = useState('10:00') // time to send fridge reminder
  const [openTime, setOpenTime]                 = useState('08:00')
  const [closeTime, setCloseTime]               = useState('17:00')
  const [complianceNavOrder, setComplianceNavOrder] = useState([])
  const [loading, setLoading]                   = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }

    // Reset to defaults before loading so stale settings from a previous venue
    // don't persist while the new venue's settings are in flight.
    setCustomRoles(DEFAULT_ROLES)
    setClosedDays([])
    setBreakDurationMins(30)
    setCleanupMinutes(0)
    setFridgeCheckTime('10:00')
    setOpenTime('08:00')
    setCloseTime('17:00')
    setComplianceNavOrder([])
    setLoading(true)

    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('venue_id', venueId)
      .in('key', ['custom_roles', 'closed_days', 'break_duration_mins', 'cleanup_minutes', 'fridge_check_time', 'open_time', 'close_time', 'compliance_nav_order'])

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
          if (row.key === 'break_duration_mins' && typeof parsed === 'number') {
            setBreakDurationMins(parsed)
          }
          if (row.key === 'cleanup_minutes' && typeof parsed === 'number') {
            setCleanupMinutes(parsed)
          }
          if (row.key === 'fridge_check_time' && typeof parsed === 'string') {
            setFridgeCheckTime(parsed)
          }
          if (row.key === 'open_time' && typeof parsed === 'string') {
            setOpenTime(parsed)
          }
          if (row.key === 'close_time' && typeof parsed === 'string') {
            setCloseTime(parsed)
          }
          if (row.key === 'compliance_nav_order' && Array.isArray(parsed)) {
            setComplianceNavOrder(parsed)
          }
        } catch { /* ignore corrupt JSON — leave defaults */ }
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

  const saveBreakDuration = useCallback(async (mins) => {
    if (!venueId) return
    setBreakDurationMins(mins)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'break_duration_mins', value: JSON.stringify(mins) })
  }, [venueId])

  const saveCleanupMinutes = useCallback(async (mins) => {
    if (!venueId) return
    setCleanupMinutes(mins)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'cleanup_minutes', value: JSON.stringify(mins) })
  }, [venueId])

  const saveFridgeCheckTime = useCallback(async (time) => {
    if (!venueId) return
    setFridgeCheckTime(time)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'fridge_check_time', value: JSON.stringify(time) })
  }, [venueId])

  const saveOpenTime = useCallback(async (time) => {
    if (!venueId) return
    setOpenTime(time)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'open_time', value: JSON.stringify(time) })
  }, [venueId])

  const saveCloseTime = useCallback(async (time) => {
    if (!venueId) return
    setCloseTime(time)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'close_time', value: JSON.stringify(time) })
  }, [venueId])

  const saveComplianceNavOrder = useCallback(async (order) => {
    if (!venueId) return
    setComplianceNavOrder(order)
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'compliance_nav_order', value: JSON.stringify(order) })
  }, [venueId])

  /** Pick the next unused colour from the palette. Falls back to the least-used colour. */
  const nextColor = useCallback(() => {
    const used = new Set(customRoles.map(r => r.color))
    const unused = COLOR_PALETTE.find(c => !used.has(c))
    if (unused) return unused
    // All colours in use — count usage and return the least-used one
    const counts = Object.fromEntries(COLOR_PALETTE.map(c => [c, 0]))
    customRoles.forEach(r => { if (counts[r.color] !== undefined) counts[r.color]++ })
    return COLOR_PALETTE.reduce((a, b) => counts[a] <= counts[b] ? a : b)
  }, [customRoles])

  return {
    customRoles, closedDays, breakDurationMins, cleanupMinutes, fridgeCheckTime,
    openTime, closeTime, complianceNavOrder,
    loading, saveCustomRoles, saveClosedDays, saveBreakDuration, saveCleanupMinutes, saveFridgeCheckTime,
    saveOpenTime, saveCloseTime, saveComplianceNavOrder,
    nextColor, reload: load,
  }
}
