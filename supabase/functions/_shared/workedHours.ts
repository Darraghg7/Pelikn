// Hours worked from clock events, for the weekly report email.
//
// The report used to sort every staff member's events into ONE stream and keep
// a single "last clock-in", so when two people overlapped (A in 09:00, B in
// 09:30, A out 17:00, B out 17:30) it counted 7.5 hours instead of 16. It also
// counted breaks as worked time. This pairs events per person, takes off
// completed breaks, and attributes a shift to the period it started in — the
// same rules as the Timesheet page (src/lib/timesheet.js).

export type ClockEvent = { staff_id: string; event_type: string; occurred_at: string }

/**
 * Minutes worked on shifts that started at or after `sinceMs`.
 * Open shifts (no clock-out yet) and open breaks count as zero, as on the
 * Timesheet. A second clock-in before a clock-out starts a fresh shift.
 */
export function workedMinutes(events: ClockEvent[], sinceMs: number): number {
  const byStaff = new Map<string, { t: number; type: string }[]>()
  for (const e of events) {
    const t = Date.parse(e.occurred_at)
    if (Number.isNaN(t)) continue
    const list = byStaff.get(e.staff_id) ?? []
    list.push({ t, type: e.event_type })
    byStaff.set(e.staff_id, list)
  }

  let totalMs = 0
  for (const list of byStaff.values()) {
    list.sort((a, b) => a.t - b.t)
    let inAt: number | null = null
    let breakStart: number | null = null
    let breakMs = 0
    for (const { t, type } of list) {
      if (type === 'clock_in') {
        inAt = t; breakStart = null; breakMs = 0
      } else if (type === 'break_start') {
        if (inAt !== null) breakStart = t
      } else if (type === 'break_end') {
        if (inAt !== null && breakStart !== null) { breakMs += t - breakStart; breakStart = null }
      } else if (type === 'clock_out' && inAt !== null) {
        if (inAt >= sinceMs) totalMs += Math.max(0, t - inAt - breakMs)
        inAt = null; breakStart = null; breakMs = 0
      }
    }
  }
  return totalMs / 60000
}
