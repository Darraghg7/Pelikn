import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function useRotaRequirements() {
  const { venueId } = useVenue()
  const [requirements, setRequirements] = useState([])
  const [loading, setLoading]           = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase
      .from('rota_requirements')
      .select('*, venue_roles(id, name, color)')
      .eq('venue_id', venueId)
      .order('day_of_week')
      .order('sort_order')
      .order('start_time')
    setRequirements(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  const addRequirement = async (req) => {
    const { error } = await supabase.from('rota_requirements').insert({
      venue_id: venueId,
      ...req,
    })
    if (!error) load()
    return { error }
  }

  const updateRequirement = async (id, updates) => {
    const { error } = await supabase.from('rota_requirements').update(updates).eq('id', id)
    if (!error) load()
    return { error }
  }

  const deleteRequirement = async (id) => {
    const { error } = await supabase.from('rota_requirements').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // Helper: requirements grouped by day_of_week
  const byDay = Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7].map(d => [d, requirements.filter(r => r.day_of_week === d)])
  )

  // Total slots to fill across all days (each slot × staff_count)
  const totalSlots = requirements.reduce((acc, r) => acc + (r.staff_count ?? 1), 0)

  return {
    requirements, byDay, totalSlots,
    loading, reload: load,
    addRequirement, updateRequirement, deleteRequirement,
  }
}
