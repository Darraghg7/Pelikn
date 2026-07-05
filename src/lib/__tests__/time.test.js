import { describe, it, expect } from 'vitest'
import {
  londonWallTimeToInstant,
  formatLondon,
  londonDateStr,
} from '../time'

/**
 * These tests assert absolute UTC instants and explicit London wall-clock
 * strings, so they must pass no matter what timezone the process runs in — that
 * is the whole point of the fix. Verified green under UTC, Europe/Madrid (the
 * reported UK+1 scenario) and America/New_York; a regression to device-local
 * parsing would break them under any non-UK zone. To reproduce:
 *   TZ=Europe/Madrid npx vitest run src/lib/__tests__/time.test.js
 */

describe('londonWallTimeToInstant', () => {
  it('treats a summer (BST) shift time as UTC+1', () => {
    // 07:00 London on 5 Jul 2026 is BST → 06:00 UTC
    const instant = londonWallTimeToInstant('2026-07-05', '07:00:00')
    expect(instant.toISOString()).toBe('2026-07-05T06:00:00.000Z')
  })

  it('treats a winter (GMT) shift time as UTC+0', () => {
    // 07:00 London on 5 Jan 2026 is GMT → 07:00 UTC
    const instant = londonWallTimeToInstant('2026-01-05', '07:00:00')
    expect(instant.toISOString()).toBe('2026-01-05T07:00:00.000Z')
  })

  it('accepts times without seconds', () => {
    expect(londonWallTimeToInstant('2026-07-05', '07:00').toISOString())
      .toBe('2026-07-05T06:00:00.000Z')
  })

  it('returns an Invalid Date for missing/garbage input', () => {
    expect(Number.isNaN(londonWallTimeToInstant('', '07:00').getTime())).toBe(true)
    expect(Number.isNaN(londonWallTimeToInstant('2026-07-05', '').getTime())).toBe(true)
  })
})

describe('formatLondon', () => {
  it('renders a stored UTC instant in London time (BST)', () => {
    // 06:00 UTC in summer displays as 07:00 London
    expect(formatLondon('2026-07-05T06:00:00.000Z', 'HH:mm')).toBe('07:00')
  })

  it('renders a stored UTC instant in London time (GMT)', () => {
    // 07:00 UTC in winter displays as 07:00 London
    expect(formatLondon('2026-01-05T07:00:00.000Z', 'HH:mm')).toBe('07:00')
  })

  it('rolls the date correctly across midnight in London', () => {
    // 23:30 UTC in summer is 00:30 the next day in London
    expect(formatLondon('2026-07-05T23:30:00.000Z', 'yyyy-MM-dd HH:mm'))
      .toBe('2026-07-06 00:30')
  })
})

describe('londonDateStr', () => {
  it('uses the London calendar day, not the UTC day', () => {
    // Just before midnight London (BST) — still the 5th in London
    expect(londonDateStr('2026-07-05T22:59:00.000Z')).toBe('2026-07-05')
    // 00:30 London on the 6th, stored as 23:30 UTC on the 5th
    expect(londonDateStr('2026-07-05T23:30:00.000Z')).toBe('2026-07-06')
  })
})

describe('late clock-in comparison (the reported bug)', () => {
  // Reproduces the scenario: a UK café shift scheduled for 07:00, a staff
  // member who clocks in exactly on time. The stored clock-in is a real UTC
  // instant; the scheduled time is a London wall-clock string. The comparison
  // must say "not late" even when this code runs on a device an hour ahead.
  const isLate = (shiftDate, startTime, clockInISO) => {
    const shiftStart = londonWallTimeToInstant(shiftDate, startTime)
    const actualIn = new Date(clockInISO)
    return actualIn.getTime() > shiftStart.getTime()
  }

  it('on-time summer clock-in is NOT late', () => {
    // 07:00 London BST = 06:00:00 UTC
    expect(isLate('2026-07-05', '07:00:00', '2026-07-05T06:00:00.000Z')).toBe(false)
  })

  it('on-time winter clock-in is NOT late', () => {
    // 07:00 London GMT = 07:00:00 UTC
    expect(isLate('2026-01-05', '07:00:00', '2026-01-05T07:00:00.000Z')).toBe(false)
  })

  it('a genuinely late clock-in IS still flagged', () => {
    // Clocked in at 07:05 London (06:05 UTC) for a 07:00 shift
    expect(isLate('2026-07-05', '07:00:00', '2026-07-05T06:05:00.000Z')).toBe(true)
  })
})
