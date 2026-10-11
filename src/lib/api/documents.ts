import { supabase } from '../supabase'
import { insertWithAttachment } from '../attachments'
import { VENUE_DOCS_BUCKET, venueDocumentPath } from '../venueDocuments'

type Row = Record<string, any>

export async function fetchDocuments(venueId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, venue_id, title, category, file_url, file_path, file_name, file_size, expiry_date, notes, uploaded_by, created_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Upload the file to the private venue-documents bucket, then record it. The
 * row stores the storage key (`file_path`); a signed URL is minted when the
 * file is opened. Throws a message ready to show the user.
 */
export async function uploadVenueDocument(venueId: string, file: File, fields: {
  title: string
  category: string
  expiryDate: string
  notes: string
  uploadedBy: string | null
}): Promise<void> {
  const path = venueDocumentPath(venueId, file.name)

  const { error: uploadErr } = await supabase.storage.from(VENUE_DOCS_BUCKET).upload(path, file, { upsert: false })
  if (uploadErr) throw new Error('File upload failed: ' + uploadErr.message)

  const { error } = await insertWithAttachment((row: Row) => supabase.from('documents').insert(row), {
    venue_id:    venueId,
    title:       fields.title.trim(),
    category:    fields.category,
    file_name:   file.name,
    file_size:   file.size,
    expiry_date: fields.expiryDate || null,
    notes:       fields.notes.trim() || null,
    uploaded_by: fields.uploadedBy,
  }, { bucket: VENUE_DOCS_BUCKET, path, pathColumn: 'file_path', urlColumn: 'file_url' })
  if (error) throw error
}
