import { supabase } from '../supabase'
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
 * PostgREST rejects an insert that names a column its schema cache does not
 * know, and it rejects the whole row — so on a database where 086 has not been
 * applied yet, `photo_path` in the payload fails every delivery check with
 * "Could not find the 'photo_path' column of 'delivery_checks' in the schema
 * cache", even when no photo was attached.
 */
function isMissingPhotoPath(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const missingColumn = error.code === 'PGRST204' || error.code === '42703'
  return missingColumn && (error.message ?? '').includes('photo_path')
}

/**
 * Insert a delivery check, recording the photo if there is one.
 *
 * A delivery check is a food-safety record and has to be loggable whatever the
 * state of the photo column, so `photo_path` is named only when a photo was
 * actually uploaded, and a database that does not have the column yet keeps
 * the photo in the legacy `photo_url`.
 */
export async function insertDeliveryCheck(
  row: Record<string, unknown>,
  photoPath?: string | null,
) {
  const res = await supabase
    .from('delivery_checks')
    .insert(photoPath ? { ...row, photo_path: photoPath } : row)
    .select()
    .single()
  if (!photoPath || !isMissingPhotoPath(res.error)) return res

  // 086 adds the column and closes the bucket in the same script, so a database
  // missing the column still has training-files public: the public URL resolves,
  // and 086's backfill converts it to a storage key whenever it is applied.
  const { data } = supabase.storage.from(TRAINING_BUCKET).getPublicUrl(photoPath)
  return supabase
    .from('delivery_checks')
    .insert({ ...row, photo_url: data?.publicUrl ?? null })
    .select()
    .single()
}
