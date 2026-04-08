import { format, formatDistanceToNow, startOfWeek, addDays } from 'date-fns'
import { STAFF_COLOUR_PALETTE } from './constants'

export const formatTemp = (t) => `${Number(t).toFixed(1)}°C`

export const formatTime = (d) => format(new Date(d), 'HH:mm')

export const formatDate = (d) => format(new Date(d), 'd MMM yyyy')

export const formatDateTime = (d) => format(new Date(d), 'd MMM yyyy HH:mm')

export const timeAgo = (d) => formatDistanceToNow(new Date(d), { addSuffix: true })

export const isTempOutOfRange = (temp, min, max) =>
  Number(temp) < Number(min) || Number(temp) > Number(max)

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
  return STAFF_COLOUR_PALETTE[parseInt(hex, 16) % STAFF_COLOUR_PALETTE.length]
}
