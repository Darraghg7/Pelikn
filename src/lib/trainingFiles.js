import { attachmentPath, attachmentUrl, openAttachment } from './attachments'

/**
 * Training certificates and delivery photos.
 *
 * The `training-files` bucket was public until migration 086 — anyone holding
 * a link could read any certificate in it. It is now private and scoped to
 * members of the venue in the object key's first path segment. Read access is
 * venue-level rather than manager-only: unlike HR records, this is operational
 * material ordinary staff legitimately see.
 */
export const TRAINING_BUCKET = 'training-files'

/** Certificates are keyed by the staff member they belong to. */
export function trainingFilePath(venueId, staffId, fileName) {
  return attachmentPath(venueId, staffId, fileName)
}

/** Delivery photos have no owning staff member, so they share one folder. */
export function deliveryPhotoPath(venueId, fileName) {
  return attachmentPath(venueId, 'delivery-photos', fileName)
}

/**
 * `file_url` is the legacy public-URL column. 086 backfilled `file_path` for
 * every existing row, so the fallback only matters for anything written
 * between that migration and this code going live.
 */
export function trainingFileUrl(row) {
  return attachmentUrl(TRAINING_BUCKET, row?.file_path, row?.file_url)
}

export function openTrainingFile(row, toast) {
  return openAttachment(TRAINING_BUCKET, row?.file_path, row?.file_url, toast)
}
