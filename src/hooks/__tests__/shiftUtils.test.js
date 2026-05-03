import { describe, it, expect } from 'vitest'
import { shiftDurationHours, unpaidBreakMins, paidShiftHours } from '../useShifts'

// ── shiftDurationHours ────────────────────────────────────────────────────────

describe('shiftDurationHours', () => {
  it('calculates a standard 8-hour shift', () => {
    expect(shiftDurationHours('09:00', '17:00')).toBe(8)
  })

  it('calculates a 4.5-hour shift', () => {
    expect(shiftDurationHours('08:00', '12:30')).toBe(4.5)
  })

  it('returns 0 for identical start and end times', () => {
    expect(shiftDurationHours('09:00', '09:00')).toBe(0)
  })

  it('returns 0 for missing start time', () => {
    expect(shiftDurationHours(null, '17:00')).toBe(0)
    expect(shiftDurationHours('', '17:00')).toBe(0)
  })

  it('returns 0 for missing end time', () => {
    expect(shiftDurationHours('09:00', null)).toBe(0)
    expect(shiftDurationHours('09:00', '')).toBe(0)
  })

  it('returns 0 when end is before start (no overnight support)', () => {
    expect(shiftDurationHours('22:00', '06:00')).toBe(0)
  })

  it('handles break-cover lunchtime shift (11:00–14:00)', () => {
    expect(shiftDurationHours('11:00', '14:00')).toBe(3)
  })

  it('handles minutes correctly', () => {
    expect(shiftDurationHours('09:15', '17:45')).toBe(8.5)
  })
})

// ── unpaidBreakMins ───────────────────────────────────────────────────────────

describe('unpaidBreakMins', () => {
  it('returns 0 for shift of 4.5 hours exactly (no break entitlement)', () => {
    expect(unpaidBreakMins(4.5, false)).toBe(0)
  })

  it('adult: returns 0 for shift of 6 hours exactly (no break entitlement)', () => {
    expect(unpaidBreakMins(6, false)).toBe(0)
  })

  it('adult: returns 30 min break for shift over 6 hours (default)', () => {
    expect(unpaidBreakMins(6.5, false)).toBe(30)
  })

  it('adult: respects custom break duration', () => {
    expect(unpaidBreakMins(7, false, 45)).toBe(45)
  })

  it('under-18: returns 0 for shift of 4.5 hours exactly', () => {
    expect(unpaidBreakMins(4.5, true)).toBe(0)
  })

  it('under-18: returns fixed 30 min break for shift over 4.5 hours', () => {
    expect(unpaidBreakMins(5, true)).toBe(30)
  })

  it('under-18: break is always 30 min regardless of custom setting', () => {
    expect(unpaidBreakMins(8, true, 60)).toBe(30)
  })
})

// ── paidShiftHours ────────────────────────────────────────────────────────────

describe('paidShiftHours', () => {
  it('returns full hours for a short shift with no break entitlement', () => {
    // 4 hour shift, adult → no break (≤6h)
    expect(paidShiftHours('09:00', '13:00', false)).toBe(4)
  })

  it('deducts 30-min break for adult working over 6 hours', () => {
    // 8h shift → 7.5h paid
    expect(paidShiftHours('09:00', '17:00', false)).toBe(7.5)
  })

  it('deducts 30-min break for under-18 working over 4.5 hours', () => {
    // 5h shift, under-18 → 4.5h paid
    expect(paidShiftHours('09:00', '14:00', true)).toBe(4.5)
  })

  it('does not deduct break for under-18 on a 4.5h shift', () => {
    expect(paidShiftHours('09:00', '13:30', true)).toBe(4.5)
  })

  it('deducts custom adult break when provided', () => {
    // 7h shift, adult, 45-min break → 6.25h paid
    expect(paidShiftHours('09:00', '16:00', false, 45)).toBeCloseTo(6.25)
  })

  it('never returns negative hours', () => {
    // Degenerate: 0-minute shift
    expect(paidShiftHours('09:00', '09:00', false)).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 when start/end are missing', () => {
    expect(paidShiftHours(null, null, false)).toBe(0)
  })
})
