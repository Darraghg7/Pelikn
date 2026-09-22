/**
 * Pure time arithmetic and formatting for the rota screens.
 *
 * These work on plain "HH:MM" strings and minute counts — deliberately not
 * the same concern as lib/time.js, which handles London wall-time and DST
 * for clock-in instants. Nothing here is timezone-aware.
 */

/** "09:00"–"17:30" → "8h 30m". Wraps past midnight. */
export function durationLabel(start, end) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Worked minutes between two "HH:MM" strings, less an unpaid break. */
export function ehWorkedMins(startStr, endStr, brkMins) {
  const [sh, sm] = startStr.split(':').map(Number)
  const [eh, em] = endStr.split(':').map(Number)
  let d = (eh * 60 + em) - (sh * 60 + sm)
  if (d < 0) d += 1440
  return d - (brkMins || 0)
}

export function ehDurLabel(mins) {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60), m = mins % 60
  if (h && m) return `${h}h ${m}m`
  return h ? `${h}h` : `${m}m`
}

/** Same as ehDurLabel but always carries an explicit + or − sign. */
export function ehSignedLabel(mins) {
  const abs = Math.abs(mins)
  return (mins < 0 ? '−' : '+') + ehDurLabel(abs)
}

export function fmtHM(date) {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

export function applyTimeToDate(baseDate, timeStr) {
  const d = new Date(baseDate)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export function timeDiffMins(a, b) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  let d = (bh * 60 + bm) - (ah * 60 + am)
  if (d < 0) d += 1440
  return d
}
