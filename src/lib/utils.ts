import { format, startOfWeek, addDays } from 'date-fns'
import { STAFF_COLOUR_PALETTE } from './constants'
import type { Staff } from '../types'

export const formatTemp = (t: number | string): string => `${Number(t).toFixed(1)}°C`

export const formatDate = (d: string | Date): string => format(new Date(d), 'd MMM yyyy')

export const formatDateTime = (d: string | Date): string => format(new Date(d), 'd MMM yyyy HH:mm')

export const isTempOutOfRange = (temp: number | string, min: number | string, max: number | string): boolean =>
  Number(temp) < Number(min) || Number(temp) > Number(max)

/** Returns the Monday of the week containing the given date. */
export const getWeekStart = (date: Date = new Date()): Date =>
  startOfWeek(date, { weekStartsOn: 1 })

/** Returns array of 7 Date objects for the week starting on Monday. */
export const getWeekDays = (weekStart: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

/** Download a CSV string as a file. */
export const downloadCsv = (csvString: string, filename: string): void => {
  const blob = new Blob([csvString], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Capitalise the first character of a string. */
export const capitalize = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

/** Convert minutes to "Xh Ym" string. */
export const formatMinutes = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0m'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/**
 * Convert a venue name into a URL-safe slug.
 * e.g. "Nomad City Centre" → "nomad-city-centre"
 */
export const slugify = (str: string): string =>
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
export const staffColour = (s: Pick<Staff, 'id' | 'colour'>): string => {
  if (s.colour) return s.colour
  const hex = (s.id ?? '').replace(/-/g, '').slice(0, 8)
  return STAFF_COLOUR_PALETTE[parseInt(hex, 16) % STAFF_COLOUR_PALETTE.length]
}
