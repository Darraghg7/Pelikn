import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface Supplier {
  id: string
  name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  is_active: boolean
  venue_id: string
}

export default function useDeliverySuppliers(venueId: string): {
  suppliers: Supplier[]
  loading: boolean
  reload: () => void
} {
  const { data: suppliers = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['delivery_suppliers', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, contact_name, contact_email, contact_phone, is_active, venue_id')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('name')
      return (data ?? []) as Supplier[]
    },
    enabled: !!venueId,
  })

  return { suppliers, loading, reload: refetch }
}
