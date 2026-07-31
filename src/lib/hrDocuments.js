import { supabase } from './supabase'

/**
 * HR attachments — employment contracts and disciplinary letters.
 *
 * The `hr-documents` bucket is private (migration 085), so these files are not
 * reachable by URL alone the way training certificates are. Rows store the
 * storage key in `file_path` and a short-lived signed URL is minted per view,
 * which means a link that leaks out of an email or a screenshot stops working
 * within the minute.
 */
export const HR_BUCKET = 'hr-documents'

/** How long a generated link stays valid. Long enough to open, not to share. */
export const HR_SIGNED_URL_TTL_SECONDS = 60

/** Storage key for a new upload: venue/staff/timestamp-filename. */
export function hrAttachmentPath(venueId, staffId, fileName) {
  const safe = String(fileName).replace(/[^a-z0-9.]/gi, '_')
  return `${venueId}/${staffId}/${Date.now()}-${safe}`
}

/**
 * Resolve a viewable URL for an HR attachment.
 * Returns null when there is nothing to open or the link could not be signed.
 *
 * `file_url` is the legacy column holding a public URL, kept only so rows
 * written before 085 still open. New rows only ever set `file_path`.
 */
export async function hrAttachmentUrl(row) {
  if (row?.file_path) {
    const { data, error } = await supabase.storage
      .from(HR_BUCKET)
      .createSignedUrl(row.file_path, HR_SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }
  return row?.file_url ?? null
}

/** Open an attachment in a new tab, reporting failure rather than doing nothing. */
export async function openHrAttachment(row, toast) {
  if (!row?.file_path && !row?.file_url) {
    toast?.('No file attached', 'error')
    return
  }
  const url = await hrAttachmentUrl(row)
  if (!url) {
    toast?.('Could not open the file — please try again', 'error')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
