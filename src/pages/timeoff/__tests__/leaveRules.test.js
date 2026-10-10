import { describe, it, expect } from 'vitest'
import { calculateEntitlementDays, countWorkingDaysInRequest } from '../../../hooks/useLeaveBalance'
import { accruedHoursFor, avgDailyHoursFor, workedStatsFromEvents } from '../../../hooks/useZeroHoursAccrual'
import { isOnlyClosedDays } from '../timeOffConstants'

describe('calculateEntitlementDays', () => {
  it('gives 5.6 weeks of a Thu–Sun pattern, rounded up to the half day', () => {
    expect(calculateEntitlementDays('part_time', [4, 5, 6, 7])).toBe(22.5)
  })
  it('never goes past the 28-day statutory maximum', () => {
    expect(calculateEntitlementDays('full_time', [2, 3, 4, 5, 6, 7])).toBe(28)
    expect(calculateEntitlementDays('full_time', [1, 2, 3, 4, 5, 6, 7])).toBe(28)
  })
  it('leaves zero-hours staff to accrual', () => {
    expect(calculateEntitlementDays('zero_hours', [2, 3, 4, 5, 6])).toBeNull()
  })
})

describe('countWorkingDaysInRequest', () => {
  // Mon 12 – Sun 18 Oct 2026
  it('only counts days on the working pattern', () => {
    expect(countWorkingDaysInRequest('2026-10-12', '2026-10-18', [4, 5, 6, 7])).toBe(4)
    expect(countWorkingDaysInRequest('2026-10-12', '2026-10-12', [4, 5, 6, 7])).toBe(0)
  })
  it('treats an unset pattern as Mon–Fri', () => {
    expect(countWorkingDaysInRequest('2026-10-17', '2026-10-18', [])).toBe(0)
    expect(countWorkingDaysInRequest('2026-10-12', '2026-10-12', [])).toBe(1)
  })
})

describe('isOnlyClosedDays', () => {
  const closedMondays = [0] // settings index, Mon = 0
  it('is true for a request made up only of closed days', () => {
    expect(isOnlyClosedDays('2026-10-12', '2026-10-12', closedMondays)).toBe(true)
  })
  it('is false when the range also covers open days', () => {
    expect(isOnlyClosedDays('2026-10-11', '2026-10-12', closedMondays)).toBe(false)
  })
  it('is false when the venue has no closed days', () => {
    expect(isOnlyClosedDays('2026-10-12', '2026-10-12', [])).toBe(false)
  })
})

describe('zero-hours accrual', () => {
  const ev = (event_type, occurred_at) => ({ event_type, occurred_at })
  it('counts worked time without breaks', () => {
    const stats = workedStatsFromEvents([
      ev('clock_in',    '2026-10-15T08:00:00Z'),
      ev('break_start', '2026-10-15T12:00:00Z'),
      ev('break_end',   '2026-10-15T12:30:00Z'),
      ev('clock_out',   '2026-10-15T16:30:00Z'),
    ])
    expect(stats).toEqual({ totalHours: 8, distinctDays: 1 })
  })
  it('accrues 12.07% of hours, capped at 224', () => {
    expect(accruedHoursFor(100)).toBe(12.1)
    expect(accruedHoursFor(5000)).toBe(224)
  })
  it('averages shift length once there are three shifts', () => {
    expect(avgDailyHoursFor({ totalHours: 16, distinctDays: 2 })).toBe(7.6)
    expect(avgDailyHoursFor({ totalHours: 24, distinctDays: 3 })).toBe(8)
  })
})
