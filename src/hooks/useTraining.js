import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export function useStaffTraining(staffId) {
  const { venueId } = useVenue()
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!staffId) { setLoading(false); return }
    setLoading(true)
    let q = supabase
      .from('staff_training')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
    if (venueId) q = q.eq('venue_id', venueId)
    const { data } = await q
    setRecords(data ?? [])
    setLoading(false)
  }, [venueId, staffId])

  useEffect(() => { load() }, [load])

  return { records, loading, reload: load }
}
