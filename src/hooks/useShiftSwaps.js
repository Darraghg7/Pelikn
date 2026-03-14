import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useShiftSwaps() {
  const [swaps, setSwaps]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('shift_swaps')
      .select('*, shift:shift_id(*)')
      .order('created_at', { ascending: false })
    setSwaps(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pendingCount = swaps.filter((s) => s.status === 'pending').length

  return { swaps, loading, reload: load, pendingCount }
}
