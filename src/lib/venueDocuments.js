import { openAttachment } from './attachments'

/**
 * Venue documents — premises licences, insurance certificates, EHO reports —
 * and supplier food-safety certificates.
 *
 * The `venue-documents` bucket was public until migration 123: anyone holding
 * a link, or the anon key shipped in the client, could list and download every
 * file in it. It is now private and scoped to members of the venue in the
 * object key's first path segment, like `training-files` (086).
 */
export const VENUE_DOCS_BUCKET = 'venue-documents'

/** Key for a document-vault upload: `<venue>/<epoch>-<random>.<ext>`. */
export function venueDocumentPath(venueId, fileName) {
  const ext = String(fileName).split('.').pop().replace(/[^a-z0-9]/gi, '') || 'bin'
  return `${venueId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
}

/** Key for a supplier certificate: `<venue>/suppliers/<epoch>-<filename>`. */
export function supplierCertPath(venueId, fileName) {
  return `${venueId}/suppliers/${Date.now()}-${String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`
}

/** `file_url` is the legacy public-URL column; 123 backfilled `file_path`. */
export function openVenueDocument(doc, toast) {
  return openAttachment(VENUE_DOCS_BUCKET, doc?.file_path, doc?.file_url, toast)
}

export function openSupplierCert(supplier, toast) {
  return openAttachment(
    VENUE_DOCS_BUCKET, supplier?.food_safety_cert_path, supplier?.food_safety_cert_url, toast,
  )
}

export function hasSupplierCert(supplier) {
  return Boolean(supplier?.food_safety_cert_path || supplier?.food_safety_cert_url)
}
