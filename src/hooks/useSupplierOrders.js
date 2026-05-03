import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export function useSuppliers() {
  const { venueId } = useVenue()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase.from('suppliers').select('id, name, contact_name, email, phone, is_active, venue_id').eq('venue_id', venueId).eq('is_active', true).order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { suppliers, loading, reload: load }
}

export function useSupplierOrders() {
  const { venueId } = useVenue()
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('supplier_orders')
      .select('id, supplier_id, supplier_name, raised_by_name, status, notes, venue_id, created_at, items:supplier_order_items(id, item_name, quantity, unit, notes)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { orders, loading, reload: load }
}
