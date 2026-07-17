import { supabase } from '../supabase'

export interface Supplier {
  id: string
  name: string
  category?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  approval_status?: string | null
  food_safety_cert_expiry?: string | null
  food_safety_cert_url?: string | null
  food_safety_cert_name?: string | null
  is_active?: boolean
  venue_id: string
}

const SUPPLIER_COLUMNS =
  'id, name, category, contact_name, phone, email, notes, approval_status, ' +
  'food_safety_cert_expiry, food_safety_cert_url, food_safety_cert_name, is_active, venue_id'

/** Active suppliers for a venue, ordered by name. */
export async function fetchSuppliers(venueId: string): Promise<Supplier[]> {
  const { data } = await supabase
    .from('suppliers')
    .select(SUPPLIER_COLUMNS)
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('name')
  // Column list is a runtime string, so supabase-js can't infer the row type.
  return (data ?? []) as unknown as Supplier[]
}

/** Insert a supplier and return the created row (`.select().single()`). */
export function insertSupplier(payload: Record<string, unknown>) {
  return supabase.from('suppliers').insert(payload).select().single()
}

export function updateSupplier(id: string, payload: Record<string, unknown>) {
  return supabase.from('suppliers').update(payload).eq('id', id)
}

/** Soft-delete: suppliers are deactivated, never hard-deleted. */
export function deactivateSupplier(id: string) {
  return supabase.from('suppliers').update({ is_active: false }).eq('id', id)
}
