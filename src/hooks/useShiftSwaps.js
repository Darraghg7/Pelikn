import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export function useShiftSwaps() {
  const { venueId } = useVenue()
  const [swaps, setSwaps]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('shift_swaps')
      .select('*, shift:shift_id(*)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
    setSwaps(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  const pendingCount = swaps.filter((s) => s.status === 'pending').length

  return { swaps, loading, reload: load, pendingCount }
}
