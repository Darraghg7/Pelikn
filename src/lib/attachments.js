import { supabase } from './supabase'

/**
 * Shared handling for files kept in a PRIVATE storage bucket.
 *
 * Private buckets are not reachable by URL alone, so nothing can be opened by
 * guessing or by a link that leaked out of an email. Rows store the storage
 * key and a short-lived signed URL is minted at the moment of viewing.
 *
 * Every private bucket keys its objects as `<venue_id>/...` — the storage
 * policies read the venue out of that first segment, so the path builder must
 * never let a filename introduce segments of its own.
 */

/** How long a generated link stays valid. Long enough to open, not to share. */
export const SIGNED_URL_TTL_SECONDS = 60

/** Storage key for a new upload: venue/owner/timestamp-filename. */
export function attachmentPath(venueId, ownerId, fileName) {
  const safe = String(fileName).replace(/[^a-z0-9.]/gi, '_')
  return `${venueId}/${ownerId}/${Date.now()}-${safe}`
}

/**
 * Resolve a viewable URL for an attachment.
 * Returns null when there is nothing to open or the link could not be signed.
 *
 * `legacyUrl` is a public URL stored before the bucket was closed. It is only
 * used when no storage key is present, and stops working once the bucket is
 * private — which is why migrations backfill the key rather than relying on it.
 */
export async function attachmentUrl(bucket, path, legacyUrl = null) {
  if (path) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }
  return legacyUrl ?? null
}

/** Open an attachment in a new tab, reporting failure rather than doing nothing. */
export async function openAttachment(bucket, path, legacyUrl, toast) {
  if (!path && !legacyUrl) {
    toast?.('No file attached', 'error')
    return
  }
  const url = await attachmentUrl(bucket, path, legacyUrl)
  if (!url) {
    toast?.('Could not open the file — please try again', 'error')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
