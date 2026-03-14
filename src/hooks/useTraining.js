import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useStaffTraining(staffId) {
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!staffId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('staff_training')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [staffId])

  useEffect(() => { load() }, [load])

  return { records, loading, reload: load }
}
