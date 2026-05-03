import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function useDeliverySuppliers(venueId) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, contact_name, email, phone, is_active, venue_id')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { suppliers, loading, reload: load }
}
