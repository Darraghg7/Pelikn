import { describe, expect, it } from 'vitest'
import { workedMinutes } from '../workedHours'

const ev = (staff_id: string, event_type: string, occurred_at: string) => ({ staff_id, event_type, occurred_at })
const since = Date.parse('2026-10-19T00:00:00Z')

describe('workedMinutes', () => {
  it('counts overlapping shifts for different people separately', () => {
    // The old single-stream version gave 7.5 hours here instead of 16.
    const events = [
      ev('a', 'clock_in',  '2026-10-20T09:00:00Z'),
      ev('b', 'clock_in',  '2026-10-20T09:30:00Z'),
      ev('a', 'clock_out', '2026-10-20T17:00:00Z'),
      ev('b', 'clock_out', '2026-10-20T17:30:00Z'),
    ]
    expect(workedMinutes(events, since) / 60).toBe(16)
  })

  it('takes completed breaks off', () => {
    const events = [
      ev('a', 'clock_in',    '2026-10-20T09:00:00Z'),
      ev('a', 'break_start', '2026-10-20T12:00:00Z'),
      ev('a', 'break_end',   '2026-10-20T12:30:00Z'),
      ev('a', 'clock_out',   '2026-10-20T17:00:00Z'),
    ]
    expect(workedMinutes(events, since)).toBe(7.5 * 60)
  })

  it('ignores an open break and an unfinished shift, like the Timesheet', () => {
    const events = [
      ev('a', 'clock_in',    '2026-10-20T09:00:00Z'),
      ev('a', 'break_start', '2026-10-20T12:00:00Z'),
      ev('a', 'clock_out',   '2026-10-20T17:00:00Z'),   // open break: counts as zero break time
      ev('b', 'clock_in',    '2026-10-21T09:00:00Z'),   // still on shift
    ]
    expect(workedMinutes(events, since)).toBe(8 * 60)
  })

  it('attributes a shift to the period it started in, whole', () => {
    const events = [
      ev('a', 'clock_in',  '2026-10-18T22:00:00Z'),   // started before the window
      ev('a', 'clock_out', '2026-10-19T02:00:00Z'),
      ev('a', 'clock_in',  '2026-10-19T20:00:00Z'),   // inside
      ev('a', 'clock_out', '2026-10-20T01:00:00Z'),
    ]
    expect(workedMinutes(events, since)).toBe(5 * 60)
  })

  it('treats a second clock-in as a fresh shift and ignores stray clock-outs', () => {
    const events = [
      ev('a', 'clock_out', '2026-10-20T08:00:00Z'),
      ev('a', 'clock_in',  '2026-10-20T09:00:00Z'),
      ev('a', 'clock_in',  '2026-10-20T10:00:00Z'),
      ev('a', 'clock_out', '2026-10-20T12:00:00Z'),
    ]
    expect(workedMinutes(events, since)).toBe(2 * 60)
  })

  it('handles events out of order and bad timestamps', () => {
    const events = [
      ev('a', 'clock_out', '2026-10-20T17:00:00Z'),
      ev('a', 'clock_in',  '2026-10-20T09:00:00Z'),
      ev('a', 'clock_in',  'not a date'),
    ]
    expect(workedMinutes(events, since)).toBe(8 * 60)
  })
})
