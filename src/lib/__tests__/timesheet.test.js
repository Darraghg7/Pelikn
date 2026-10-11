import { describe, it, expect } from 'vitest'
import {
  buildTimesheets,
  buildDailyGrid,
  partitionDaySessions,
  sessionMinutes,
  breakMinutes,
  latePunch,
  LATE_PUNCH_THRESHOLD_MS,
} from '../timesheet'

/**
 * These assert absolute instants and London calendar dates, so they hold in any
 * process timezone. Run under a non-UK zone to check the day-bucketing fix:
 *   TZ=America/New_York npx vitest run src/lib/__tests__/timesheet.test.js
 */

let seq = 0
const ev = (staff_id, event_type, occurred_at, name = 'Ana') =>
  ({ id: `e${++seq}`, staff_id, event_type, occurred_at, staff: { name } })

describe('sessionMinutes / breakMinutes', () => {
  it('subtracts completed breaks from worked time', () => {
    expect(sessionMinutes({
      in: '2026-07-05T08:00:00Z',
      out: '2026-07-05T16:00:00Z',
      breaks: [{ start: '2026-07-05T12:00:00Z', end: '2026-07-05T12:30:00Z' }],
    })).toBe(450)
  })

  it('ignores a break that was never ended', () => {
    expect(breakMinutes([{ start: '2026-07-05T12:00:00Z', end: null }])).toBe(0)
  })

  it('is zero for a session with no clock-out', () => {
    expect(sessionMinutes({ in: '2026-07-05T08:00:00Z', out: null, breaks: [] })).toBe(0)
  })

  it('never goes negative when clock-out precedes clock-in', () => {
    expect(sessionMinutes({
      in: '2026-07-05T18:00:00Z', out: '2026-07-05T02:00:00Z', breaks: [],
    })).toBe(0)
  })
})

describe('buildTimesheets', () => {
  it('totals a straightforward shift', () => {
    const rows = buildTimesheets([
      ev('ana', 'clock_in',  '2026-07-05T08:00:00Z'),
      ev('ana', 'clock_out', '2026-07-05T16:00:00Z'),
    ], { ana: 12 })
    expect(rows).toHaveLength(1)
    expect(rows[0].totalMinutes).toBe(480)
    expect(rows[0].hourlyRate).toBe(12)
  })

  it('counts both halves of a split shift', () => {
    const rows = buildTimesheets([
      ev('ana', 'clock_in',  '2026-07-05T10:00:00Z'),
      ev('ana', 'clock_out', '2026-07-05T14:00:00Z'),
      ev('ana', 'clock_in',  '2026-07-05T17:00:00Z'),
      ev('ana', 'clock_out', '2026-07-05T22:00:00Z'),
    ], {})
    expect(rows[0].totalMinutes).toBe(540)
  })

  it('still counts the real shift when a duplicate clock-in precedes it', () => {
    // The retry-duplicate case migration 106 now prevents at the source. The
    // orphan contributes nothing; the completed session is paid in full.
    const rows = buildTimesheets([
      ev('ana', 'clock_in',  '2026-07-05T08:00:00Z'),
      ev('ana', 'clock_in',  '2026-07-05T08:00:21Z'),
      ev('ana', 'clock_out', '2026-07-05T16:00:00Z'),
    ], {})
    expect(rows[0].sessions).toHaveLength(2)
    expect(Math.round(rows[0].totalMinutes)).toBe(480)
  })

  it('sorts by staff name', () => {
    const rows = buildTimesheets([
      ev('zoe', 'clock_in', '2026-07-05T08:00:00Z', 'Zoe'),
      ev('ana', 'clock_in', '2026-07-05T08:00:00Z', 'Ana'),
    ], {})
    expect(rows.map(r => r.name)).toEqual(['Ana', 'Zoe'])
  })
})

describe('buildDailyGrid', () => {
  it('files a session under its London date, not its UTC date', () => {
    // 00:30 London on 6 July (BST) is 23:30 UTC on 5 July. Slicing the ISO
    // string put this shift on the 5th, a day before the person worked it.
    const grid = buildDailyGrid([
      ev('ana', 'clock_in',  '2026-07-05T23:30:00Z'),
      ev('ana', 'clock_out', '2026-07-06T05:30:00Z'),
    ])
    expect(Object.keys(grid.ana.days)).toEqual(['2026-07-06'])
    expect(grid.ana.days['2026-07-06'].minutes).toBe(360)
  })

  it('keeps an overnight shift on the day it started', () => {
    // 18:00-02:00 London: filed under the 5th, the day the shift began.
    const grid = buildDailyGrid([
      ev('ana', 'clock_in',  '2026-07-05T17:00:00Z'),
      ev('ana', 'clock_out', '2026-07-06T01:00:00Z'),
    ])
    expect(Object.keys(grid.ana.days)).toEqual(['2026-07-05'])
    expect(grid.ana.days['2026-07-05'].minutes).toBe(480)
  })

  it('records every session of a split shift on the same day', () => {
    const grid = buildDailyGrid([
      ev('ana', 'clock_in',  '2026-07-05T10:00:00Z'),
      ev('ana', 'clock_out', '2026-07-05T14:00:00Z'),
      ev('ana', 'clock_in',  '2026-07-05T17:00:00Z'),
      ev('ana', 'clock_out', '2026-07-05T22:00:00Z'),
    ])
    expect(grid.ana.days['2026-07-05'].sessions).toHaveLength(2)
    expect(grid.ana.days['2026-07-05'].minutes).toBe(540)
  })

  it('attaches a break to the session it happened in', () => {
    const grid = buildDailyGrid([
      ev('ana', 'clock_in',    '2026-07-05T08:00:00Z'),
      ev('ana', 'break_start', '2026-07-05T12:00:00Z'),
      ev('ana', 'break_end',   '2026-07-05T12:30:00Z'),
      ev('ana', 'clock_out',   '2026-07-05T16:00:00Z'),
    ])
    const day = grid.ana.days['2026-07-05']
    expect(day.sessions[0].breaks).toHaveLength(1)
    expect(day.minutes).toBe(450)
  })
})

describe('partitionDaySessions', () => {
  const open     = { in: '2026-07-05T08:00:00Z', out: null }
  const complete = { in: '2026-07-05T08:00:21Z', out: '2026-07-05T16:00:00Z' }

  it('sets aside a dangling clock-in that another session follows', () => {
    // This is the bug the manager saw: the orphan was drawn as the day's only
    // session, so a fully worked day rendered as "Off".
    const { real, orphans } = partitionDaySessions([open, complete])
    expect(real).toEqual([complete])
    expect(orphans).toEqual([open])
  })

  it('keeps a trailing open session — that is someone still on shift', () => {
    const { real, orphans } = partitionDaySessions([open])
    expect(real).toEqual([open])
    expect(orphans).toEqual([])
  })

  it('keeps every session of a normal split shift', () => {
    const first  = { in: '2026-07-05T10:00:00Z', out: '2026-07-05T14:00:00Z' }
    const second = { in: '2026-07-05T17:00:00Z', out: '2026-07-05T22:00:00Z' }
    const { real, orphans } = partitionDaySessions([first, second])
    expect(real).toEqual([first, second])
    expect(orphans).toEqual([])
  })

  it('handles a day with nothing on it', () => {
    expect(partitionDaySessions([])).toEqual({ real: [], orphans: [] })
    expect(partitionDaySessions(undefined)).toEqual({ real: [], orphans: [] })
  })
})

describe('latePunch', () => {
  const at = (occurred_at, recorded_at) =>
    ({ id: 'p1', staff_id: 'ana', event_type: 'clock_in', occurred_at, recorded_at })

  it('ignores a punch that arrived within ten minutes', () => {
    expect(latePunch(at('2026-10-08T09:00:00Z', '2026-10-08T09:00:02Z'))).toBeNull()
    expect(latePunch(at('2026-10-08T09:00:00Z', '2026-10-08T09:10:00Z'))).toBeNull()
  })

  it('flags a punch that arrived more than ten minutes after the tap', () => {
    expect(LATE_PUNCH_THRESHOLD_MS).toBe(10 * 60 * 1000)
    expect(latePunch(at('2026-10-08T09:00:00Z', '2026-10-08T09:10:01Z'))).toEqual({
      id: 'p1', type: 'clock_in', occurredAt: '2026-10-08T09:00:00Z', recordedAt: '2026-10-08T09:10:01Z',
    })
  })

  it('never flags rows from before migration 144', () => {
    expect(latePunch(at('2026-10-08T09:00:00Z', null))).toBeNull()
    expect(latePunch(at('2026-10-08T09:00:00Z', undefined))).toBeNull()
  })

  it('does not flag clock skew the other way', () => {
    expect(latePunch(at('2026-10-08T09:30:00Z', '2026-10-08T09:00:00Z'))).toBeNull()
  })

  it('collects late punches onto the session they belong to', () => {
    const grid = buildDailyGrid([
      { ...ev('ana', 'clock_in', '2026-10-08T08:00:00Z'), recorded_at: '2026-10-08T08:00:01Z' },
      { ...ev('ana', 'break_start', '2026-10-08T12:00:00Z'), recorded_at: '2026-10-08T13:05:00Z' },
      { ...ev('ana', 'break_end', '2026-10-08T12:30:00Z'), recorded_at: '2026-10-08T13:05:00Z' },
      ev('ana', 'clock_out', '2026-10-08T16:00:00Z'),
    ])
    const [session] = grid.ana.days['2026-10-08'].sessions
    expect(session.late.map(p => p.type)).toEqual(['break_start', 'break_end'])

    const [t] = buildTimesheets([
      { ...ev('ana', 'clock_in', '2026-10-08T08:00:00Z'), recorded_at: '2026-10-10T08:00:00Z' },
    ])
    expect(t.sessions[0].late).toHaveLength(1)
  })
})
