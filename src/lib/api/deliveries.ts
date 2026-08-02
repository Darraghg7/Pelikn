import { supabase } from '../supabase'
import { insertWithAttachment } from '../attachments'
import { TRAINING_BUCKET } from '../trainingFiles'

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

/**
 * Insert a delivery check and return the created row (`.select().single()`).
 *
 * A delivery check is a food-safety record and has to be loggable whatever
 * state `photo_path` is in — on a database where 086 has not been applied yet,
 * naming the column failed every check with "Could not find the 'photo_path'
 * column of 'delivery_checks' in the schema cache", photo or no photo.
 */
export function insertDeliveryCheck(
  row: Record<string, unknown>,
  photoPath?: string | null,
) {
  return insertWithAttachment(
    (payload: Record<string, unknown>) =>
      supabase.from('delivery_checks').insert(payload).select().single(),
    row,
    { bucket: TRAINING_BUCKET, path: photoPath, pathColumn: 'photo_path', urlColumn: 'photo_url' },
  )
}
