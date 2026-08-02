import { supabase } from '../supabase'
import { insertWithAttachment } from '../attachments'
import { TRAINING_BUCKET } from '../trainingFiles'

export interface StaffLite {
  id: string
  name: string
  job_role?: string | null
  photo_url?: string | null
}

export interface SignOffRecord {
  id: string
  venue_id: string
  staff_id: string
  created_at: string
  staff?: StaffLite | null
  [key: string]: unknown
}

export interface CertRecord {
  id: string
  venue_id: string
  staff_id: string
  expiry_date?: string | null
  staff?: StaffLite | null
  [key: string]: unknown
}

/** Training sign-offs for a venue, newest first, with the signed-off staff joined. */
export async function fetchSignOffs(venueId: string): Promise<SignOffRecord[]> {
  const { data } = await supabase
    .from('training_sign_offs')
    .select('*, staff:staff_id(id, name, job_role, photo_url)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as SignOffRecord[]
}

/** Certificate/training records for a venue, soonest expiry first. */
export async function fetchCertRecords(venueId: string): Promise<CertRecord[]> {
  const { data } = await supabase
    .from('staff_training')
    .select('*, staff:staff_id(id, name, job_role, photo_url)')
    .eq('venue_id', venueId)
    .order('expiry_date', { ascending: true, nullsFirst: false })
  return (data ?? []) as unknown as CertRecord[]
}

/** Active staff for a venue (name/role/photo), for the training assignment pickers. */
export async function fetchActiveStaff(venueId: string): Promise<StaffLite[]> {
  const { data } = await supabase
    .from('staff')
    .select('id, name, job_role, photo_url')
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as StaffLite[]
}

/** Allergen-awareness training records for a venue, newest issue date first. */
export async function fetchAllergenCerts(venueId: string): Promise<CertRecord[]> {
  const { data } = await supabase
    .from('staff_training')
    .select('*, staff:staff_id(id, name)')
    .eq('venue_id', venueId)
    .eq('category', 'allergen_awareness')
    .order('issued_date', { ascending: false, nullsFirst: false })
  return (data ?? []) as unknown as CertRecord[]
}

export function insertSignOff(payload: Record<string, unknown>) {
  return supabase.from('training_sign_offs').insert(payload)
}

/**
 * Insert a certificate record, recording the uploaded file if there is one.
 *
 * `file_path` comes from 086, which is applied by hand — until it has been,
 * naming the column rejects the whole record with "Could not find the
 * 'file_path' column of 'staff_training' in the schema cache", even for a
 * certificate with no file attached. Training is a compliance record and has to
 * be loggable either way, so the file falls back to the legacy `file_url`.
 */
export function insertTrainingRecord(
  payload: Record<string, unknown>,
  filePath?: string | null,
) {
  return insertWithAttachment(
    (row: Record<string, unknown>) => supabase.from('staff_training').insert(row),
    payload,
    { bucket: TRAINING_BUCKET, path: filePath, pathColumn: 'file_path', urlColumn: 'file_url' },
  )
}

export function deleteTrainingRecord(id: string, venueId: string) {
  return supabase.from('staff_training').delete().eq('id', id).eq('venue_id', venueId)
}
