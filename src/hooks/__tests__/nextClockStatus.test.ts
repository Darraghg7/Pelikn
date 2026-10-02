import { describe, it, expect } from 'vitest'
import { nextClockStatus } from '../useClockEvents'

const clockIn = new Date('2026-10-02T09:00:00Z')
const at      = new Date('2026-10-02T12:00:00Z')

describe('nextClockStatus', () => {
  it('starting a break keeps the shift start and records when the break began', () => {
    const next = nextClockStatus('break_start', { status: 'clocked_in', clockInAt: clockIn, breakStartAt: null, totalBreakMs: 600_000 }, at)
    expect(next).toEqual({ status: 'on_break', clockInAt: clockIn, breakStartAt: at, totalBreakMs: 600_000 })
  })

  it('ending a break adds its length to the break total', () => {
    const breakStart = new Date('2026-10-02T11:30:00Z')
    const next = nextClockStatus('break_end', { status: 'on_break', clockInAt: clockIn, breakStartAt: breakStart, totalBreakMs: 600_000 }, at)
    expect(next).toEqual({ status: 'clocked_in', clockInAt: clockIn, breakStartAt: null, totalBreakMs: 600_000 + 30 * 60_000 })
  })

  it('clocking in starts a fresh session', () => {
    const next = nextClockStatus('clock_in', { status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 }, at)
    expect(next).toEqual({ status: 'clocked_in', clockInAt: at, breakStartAt: null, totalBreakMs: 0 })
  })

  it('clocking out clears the session', () => {
    const next = nextClockStatus('clock_out', { status: 'clocked_in', clockInAt: clockIn, breakStartAt: null, totalBreakMs: 600_000 }, at)
    expect(next).toEqual({ status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 })
  })
})
