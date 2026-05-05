import { supabase } from '../supabase'

export interface DeliveryCheck {
  id: string
  venue_id: string
  checked_at: string
  supplier_id?: string
  checked_by?: string
  temperature?: number
  notes?: string
  checker?: { name: string }
  supplier?: { name: string }
}

export async function fetchDeliveryChecks(venueId: string): Promise<DeliveryCheck[]> {
  const { data } = await supabase
    .from('delivery_checks')
    .select('*, checker:staff!checked_by(name), supplier:suppliers(name)')
    .eq('venue_id', venueId)
    .order('checked_at', { ascending: false })
    .limit(100)
  return (data ?? []) as DeliveryCheck[]
}
