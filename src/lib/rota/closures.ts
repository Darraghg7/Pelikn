import { eachDayOfInterval, format, parseISO } from 'date-fns'

/** A one-off closure range from venue_closures. */
export interface ClosureRange {
  start_date: string
  end_date: string
}

/** Every date (yyyy-MM-dd) covered by the closure ranges. Unreadable ranges are skipped. */
export function closureDateSet(closures: ClosureRange[]): Set<string> {
  const set = new Set<string>()
  for (const c of closures) {
    try {
      eachDayOfInterval({ start: parseISO(c.start_date), end: parseISO(c.end_date) })
        .forEach((d) => set.add(format(d, 'yyyy-MM-dd')))
    } catch { /* skip invalid ranges */ }
  }
  return set
}
