/**
 * Timesheet grouping — turns a flat stream of clock_events into sessions,
 * per-staff totals and a per-day grid.
 *
 * Extracted from TimesheetPage so the payroll arithmetic can be tested without
 * a renderer. These are the functions that decide what a staff member gets
 * paid, and they were previously only exercised by looking at the screen.
 *
 * Every function here takes events **ordered by staff_id, then occurred_at** —
 * which is what useTimesheetData asks PostgREST for. Out-of-order input pairs
 * clock-outs with the wrong session.
 */
import { londonDateStr } from './time'

/** Minutes between two ISO instants, never negative. */
function minutesBetween(startIso, endIso) {
  return (new Date(endIso) - new Date(startIso)) / 60000
}

/** Total completed break minutes on a session. Open breaks count as zero. */
export function breakMinutes(breaks) {
  return (breaks ?? []).reduce(
    (acc, b) => (!b.start || !b.end) ? acc : acc + minutesBetween(b.start, b.end),
    0
  )
}

/** Paid minutes for one session: worked time less completed breaks. */
export function sessionMinutes(session) {
  if (!session?.in || !session?.out) return 0
  return Math.max(0, minutesBetween(session.in, session.out) - breakMinutes(session.breaks))
}

/**
 * Attach a non-clock_in event to the session it belongs to — always the most
 * recent one opened for that staff member.
 */
function applyEventToSessions(sessions, e) {
  if (!sessions.length) return
  const last = sessions[sessions.length - 1]
  if (e.event_type === 'clock_out') {
    last.out = e.occurred_at
    last.outId = e.id
  } else if (e.event_type === 'break_start') {
    last.breaks.push({ start: e.occurred_at, startId: e.id, end: null, endId: null })
  } else if (e.event_type === 'break_end' && last.breaks.length) {
    const lb = last.breaks[last.breaks.length - 1]
    if (!lb.end) { lb.end = e.occurred_at; lb.endId = e.id }
  }
}

/** Per-staff totals for the period, sorted by name. */
export function buildTimesheets(events, staffRates) {
  const results = {}
  for (const e of events) {
    const sid = e.staff_id
    if (!results[sid]) {
      results[sid] = {
        staffId: sid,
        name: e.staff?.name ?? 'Unknown',
        hourlyRate: staffRates?.[sid] ?? 0,
        sessions: [],
        totalMinutes: 0,
      }
    }
    const r = results[sid]
    if (e.event_type === 'clock_in') {
      r.sessions.push({ in: e.occurred_at, inId: e.id, out: null, outId: null, breaks: [] })
    } else {
      applyEventToSessions(r.sessions, e)
    }
  }
  for (const r of Object.values(results)) {
    r.totalMinutes = r.sessions.reduce((acc, s) => acc + sessionMinutes(s), 0)
  }
  return Object.values(results).sort((a, b) => a.name.localeCompare(b.name))
}

/** Per-staff, per-day sessions and minutes. */
export function buildDailyGrid(events) {
  const grid = {}
  for (const e of events) {
    const sid = e.staff_id
    if (!grid[sid]) grid[sid] = { sessions: [] }
    const r = grid[sid]
    if (e.event_type === 'clock_in') {
      r.sessions.push({
        in: e.occurred_at,
        inId: e.id,
        out: null,
        outId: null,
        breaks: [],
        // The London calendar date, not the UTC one. Slicing the ISO string
        // filed any shift starting between midnight and 01:00 BST onto the
        // previous day, because 00:30 London is 23:30 UTC the day before —
        // so an after-midnight start vanished from the day the manager looked at.
        date: londonDateStr(e.occurred_at),
      })
    } else {
      applyEventToSessions(r.sessions, e)
    }
  }

  const result = {}
  for (const [sid, r] of Object.entries(grid)) {
    result[sid] = { staffId: sid, days: {} }
    for (const s of r.sessions) {
      if (!s.in) continue
      if (!result[sid].days[s.date]) result[sid].days[s.date] = { minutes: 0, sessions: [] }
      const day = result[sid].days[s.date]
      day.sessions.push({ in: s.in, inId: s.inId, out: s.out, outId: s.outId, breaks: s.breaks })
      day.minutes += sessionMinutes(s)
    }
  }
  return result
}

/**
 * Split a day's sessions into the ones worth showing and the ones that are
 * almost certainly a duplicate punch.
 *
 * A clock_in with no clock_out that is *followed by another session the same
 * day* is abandoned: the person didn't work two shifts and forget to end the
 * first — a retried write recorded the same punch twice (see migration 106,
 * which stops new ones being created).
 *
 * Rendering that dangling row as the day's session is what made a fully worked,
 * fully clocked day show as "Off" with an Add button. It is also why adding the
 * hours by hand looked like it hadn't saved: the new session went in *after*
 * the orphan, and only the first session was ever drawn.
 *
 * A trailing open session is left alone — that is someone still on shift, or a
 * genuinely missed clock-out, and the manager needs to see it.
 */
export function partitionDaySessions(sessions) {
  const real = [], orphans = []
  ;(sessions ?? []).forEach((s, i) => {
    const abandoned = !s.out && i < sessions.length - 1
    ;(abandoned ? orphans : real).push(s)
  })
  return { real, orphans }
}
