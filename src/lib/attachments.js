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

/**
 * True when `error` is PostgREST refusing a statement because `column` is not
 * in its schema cache (PGRST204 on a write, 42703 on a read).
 *
 * 085 and 086 are applied by hand in the SQL editor, so a database can be
 * running the client that writes a storage key before it has the column to put
 * it in.
 */
export function isMissingColumn(error, column) {
  if (!error) return false
  const missing = error.code === 'PGRST204' || error.code === '42703'
  return missing && String(error.message ?? '').includes(column)
}

/**
 * Insert a row that may carry an attachment, without letting the attachment
 * decide whether the row can be written at all.
 *
 * PostgREST rejects the whole row over a column its schema cache does not know
 * — including one set to null — so `pathColumn` is named only when there is a
 * file, and a database that turns out not to have it keeps the file in the
 * legacy `urlColumn` instead. The migrations that add the storage key close the
 * bucket in the same script, so a database missing the column still has the
 * bucket public: the URL resolves, and the migration's backfill converts it to
 * a storage key whenever it is applied.
 *
 * `insert` is a callback so the caller keeps control of the query it builds
 * (`.select().single()` or a bare insert).
 */
export async function insertWithAttachment(insert, row, { bucket, path, pathColumn, urlColumn }) {
  const res = await insert(path ? { ...row, [pathColumn]: path } : row)
  if (!path || !isMissingColumn(res.error, pathColumn)) return res

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return insert({ ...row, [urlColumn]: data?.publicUrl ?? null })
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
