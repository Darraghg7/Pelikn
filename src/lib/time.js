/**
 * Timezone helpers — all café scheduling is anchored to UK time.
 *
 * Every venue using Pelikn is in the UK, so a scheduled shift time like
 * "07:00:00" always means 07:00 in London, regardless of the timezone of the
 * device/browser viewing the app. Clock-in/out instants are stored in UTC
 * (Postgres `timestamptz`); these helpers convert between that stored UTC and
 * London wall-clock time for both comparison and display.
 *
 * Built on the platform Intl APIs so GMT↔BST (British Summer Time) switches are
 * handled automatically for the correct date — no external dependency, no
 * hard-coded +00:00/+01:00 offset, and no dependence on the device timezone.
 */
import { format as fnsFormat } from 'date-fns'

export const LONDON_TZ = 'Europe/London'

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
})

/** Numeric London calendar/clock fields for an instant. */
function londonParts(instant) {
  const parts = partsFormatter.formatToParts(instant).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = Number(p.value)
    return acc
  }, {})
  // Some engines render midnight as hour "24" — normalise to 0.
  if (parts.hour === 24) parts.hour = 0
  return parts
}

/**
 * London's UTC offset, in minutes, at a given instant.
 * +60 during BST (summer), 0 during GMT (winter).
 */
function londonOffsetMinutes(instant) {
  const p = londonParts(instant)
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUTC - instant.getTime()) / 60000)
}

/** A Date whose *local* fields equal the given London wall-clock fields, so
 *  date-fns (which formats using local fields) renders London time regardless
 *  of the process/browser timezone. Its absolute instant is irrelevant. */
function londonPartsAsLocalDate(instant) {
  const p = londonParts(instant)
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

/**
 * Interpret a date + wall-clock time as **London time** and return the matching
 * UTC instant (a Date). Use this everywhere a scheduled shift time is compared
 * against a stored clock-in, or where a typed time must be saved.
 *
 * @param {string} dateStr  e.g. "2026-07-05"
 * @param {string} timeStr  e.g. "07:00", "07:00:00" (seconds optional)
 * @returns {Date} the instant, or an Invalid Date if the inputs are unparseable
 */
export function londonWallTimeToInstant(dateStr, timeStr) {
  if (!dateStr || !timeStr) return new Date(NaN)
  const [y, mo, d] = String(dateStr).split('-').map(Number)
  const [h, mi, s] = String(timeStr).split(':').map(Number)
  if ([y, mo, d, h, mi].some(Number.isNaN)) return new Date(NaN)

  // First guess: treat the wall time as if it were UTC.
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, s || 0)
  // Subtract London's offset at that guess to land on the real instant. A second
  // pass re-evaluates the offset at the corrected instant so times near a DST
  // boundary resolve to the offset that actually applies to them.
  const offset1 = londonOffsetMinutes(new Date(utcGuess))
  const instant1 = utcGuess - offset1 * 60000
  const offset2 = londonOffsetMinutes(new Date(instant1))
  return new Date(utcGuess - offset2 * 60000)
}

/**
 * Format a stored instant (Date | ISO string | ms) in London time.
 * @param {Date|string|number} instant
 * @param {string} fmt  a date-fns format token string, e.g. "HH:mm"
 */
export function formatLondon(instant, fmt) {
  const d = instant instanceof Date ? instant : new Date(instant)
  if (Number.isNaN(d.getTime())) return ''
  return fnsFormat(londonPartsAsLocalDate(d), fmt)
}

/** The London calendar date ("yyyy-MM-dd") for a given instant. */
export function londonDateStr(instant) {
  const d = instant instanceof Date ? instant : new Date(instant)
  if (Number.isNaN(d.getTime())) return ''
  const p = londonParts(d)
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  return `${p.year}-${mm}-${dd}`
}

/** Today's date in London as "yyyy-MM-dd". */
export function londonToday() {
  return londonDateStr(new Date())
}

/**
 * The UTC instant for the start (00:00 London) of the given London date.
 * Use for "events since the start of today" queries so the day window is
 * anchored to London midnight, not the device's midnight.
 * @param {string} [dateStr]  defaults to today in London
 */
export function londonDayStartInstant(dateStr = londonToday()) {
  return londonWallTimeToInstant(dateStr, '00:00:00')
}
