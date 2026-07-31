import { attachmentPath, attachmentUrl, openAttachment, SIGNED_URL_TTL_SECONDS } from './attachments'

/**
 * HR attachments — employment contracts and disciplinary letters.
 *
 * The `hr-documents` bucket is private (migration 085) and its storage policy
 * is stricter than the others: managers and owners of the venue only, never
 * ordinary staff. See is_venue_hr_manager() in that migration.
 */
export const HR_BUCKET = 'hr-documents'
export const HR_SIGNED_URL_TTL_SECONDS = SIGNED_URL_TTL_SECONDS

export const hrAttachmentPath = attachmentPath

/**
 * `file_url` is the legacy public-URL column, kept only so rows written before
 * 085 still open. New rows only ever set `file_path`.
 */
export function hrAttachmentUrl(row) {
  return attachmentUrl(HR_BUCKET, row?.file_path, row?.file_url)
}

export function openHrAttachment(row, toast) {
  return openAttachment(HR_BUCKET, row?.file_path, row?.file_url, toast)
}
