import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface Supplier {
  id: string
  name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  is_active: boolean
  venue_id: string
}

interface OrderItem {
  id: string
  product_name: string
  quantity?: number
  unit?: string
  received?: boolean
  notes?: string
}

interface SupplierOrder {
  id: string
  supplier_id: string
  status: string
  order_date?: string
  delivery_date?: string
  notes?: string
  venue_id: string
  created_at: string
  items?: OrderItem[]
}

export function useSuppliers(): { suppliers: Supplier[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['suppliers', venueId]

  const { data: suppliers = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name, contact_name, contact_email, contact_phone, is_active, venue_id').eq('venue_id', venueId).eq('is_active', true).order('name')
      return (data ?? []) as Supplier[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { suppliers, loading, reload }
}

export function useSupplierOrders(): { orders: SupplierOrder[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['supplier_orders', venueId]

  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('supplier_orders')
        .select('id, supplier_id, status, order_date, delivery_date, notes, venue_id, created_at, items:supplier_order_items(id, product_name, quantity, unit, received, notes)')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
      return (data ?? []) as SupplierOrder[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { orders, loading, reload }
}
