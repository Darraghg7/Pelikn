import { format, startOfWeek, addDays } from 'date-fns'
import { STAFF_COLOUR_PALETTE } from './constants'

export const formatTemp = (t) => `${Number(t).toFixed(1)}°C`

export const formatDate = (d) => format(new Date(d), 'd MMM yyyy')

export const formatDateTime = (d) => format(new Date(d), 'd MMM yyyy HH:mm')

export const isTempOutOfRange = (temp, min, max) =>
  Number(temp) < Number(min) || Number(temp) > Number(max)

/**
 * Was a STORED reading outside the range its fridge had when it was taken?
 * Readings carry a snapshot of that range (migration 163); judging them
 * against the fridge's current range let a later change turn past failures
 * into passes. Older readings have no snapshot and use the current range.
 * @param {{ temperature: number|string, range_min?: number|null, range_max?: number|null }} log
 * @param {{ min_temp?: number|string|null, max_temp?: number|string|null } | null | undefined} fridge
 */
export const readingOutOfRange = (log, fridge) =>
  isTempOutOfRange(log.temperature, log.range_min ?? fridge?.min_temp, log.range_max ?? fridge?.max_temp)

/** A short note for a reading that wasn't entered at the time it was taken, or whose reason was changed. */
export const readingAuditNotes = (log) => {
  const notes = []
  if (log.is_backfilled) notes.push('late entry')
  if (log.reason_changed_at) notes.push('reason changed')
  return notes
}

/** Returns the Monday of the week containing the given date. */
export const getWeekStart = (date = new Date()) =>
  startOfWeek(date, { weekStartsOn: 1 })

/** Returns array of 7 Date objects for the week starting on Monday. */
export const getWeekDays = (weekStart) =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

/** Download a CSV string as a file. */
export const downloadCsv = (csvString, filename) => {
  const blob = new Blob([csvString], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Capitalise the first character of a string. */
export const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

/** Escape text for building HTML by hand (print windows), so user-entered names can't inject markup. */
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

/** Convert minutes to "Xh Ym" string. */
export const formatMinutes = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '0m'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/**
 * Convert a venue name into a URL-safe slug.
 * e.g. "Nomad City Centre" → "nomad-city-centre"
 */
export const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)

/**
 * Returns the rota display colour for a staff member.
 * Uses their saved hex if set, otherwise deterministically picks from the
 * palette based on their UUID — same staff always gets the same colour.
 */
export const staffColour = (s) => {
  if (s.colour) return s.colour
  const hex = (s.id ?? '').replace(/-/g, '').slice(0, 8)
  const idx = parseInt(hex, 16)
  return STAFF_COLOUR_PALETTE[
    Number.isNaN(idx) ? 0 : idx % STAFF_COLOUR_PALETTE.length
  ]
}
