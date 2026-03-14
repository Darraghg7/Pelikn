import { format, formatDistanceToNow, startOfWeek, addDays } from 'date-fns'

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

/** Convert minutes to "Xh Ym" string. */
export const formatMinutes = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '0m'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
