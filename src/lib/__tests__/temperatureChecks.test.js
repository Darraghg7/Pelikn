import { describe, it, expect } from 'vitest'
import {
  getCheckDays,
  getRequiredPeriods,
  isCheckRequired,
  formatCheckDays,
  formatRequiredPeriods,
  DEFAULT_CHECK_DAYS,
  DEFAULT_CHECK_PERIODS,
} from '../temperatureChecks'

describe('getCheckDays', () => {
  it('returns custom check_days when set', () => {
    expect(getCheckDays({ check_days: [1, 2, 3] })).toEqual([1, 2, 3])
  })

  it('returns defaults when check_days is empty', () => {
    expect(getCheckDays({ check_days: [] })).toEqual(DEFAULT_CHECK_DAYS)
  })

  it('returns defaults when check_days is missing', () => {
    expect(getCheckDays({})).toEqual(DEFAULT_CHECK_DAYS)
  })

  it('returns defaults for null/undefined item', () => {
    expect(getCheckDays(null)).toEqual(DEFAULT_CHECK_DAYS)
    expect(getCheckDays(undefined)).toEqual(DEFAULT_CHECK_DAYS)
  })
})

describe('getRequiredPeriods', () => {
  it('returns custom periods when set', () => {
    expect(getRequiredPeriods({ required_periods: ['am'] })).toEqual(['am'])
  })

  it('returns defaults when required_periods is empty', () => {
    expect(getRequiredPeriods({ required_periods: [] })).toEqual(DEFAULT_CHECK_PERIODS)
  })

  it('returns defaults when field is missing', () => {
    expect(getRequiredPeriods({})).toEqual(DEFAULT_CHECK_PERIODS)
  })
})

describe('isCheckRequired', () => {
  // Monday = day 1, Tuesday = day 2, etc.
  const monday = new Date('2024-06-10') // Monday

  it('requires check when day is included and no period filter', () => {
    expect(isCheckRequired({ check_days: [1] }, monday)).toBe(true)
  })

  it('does not require check when day is not included', () => {
    expect(isCheckRequired({ check_days: [2, 3] }, monday)).toBe(false)
  })

  it('requires check when day AND period match', () => {
    expect(isCheckRequired({ check_days: [1], required_periods: ['am'] }, monday, 'am')).toBe(true)
  })

  it('does not require check when period does not match', () => {
    expect(isCheckRequired({ check_days: [1], required_periods: ['pm'] }, monday, 'am')).toBe(false)
  })

  it('does not require check when day matches but period does not', () => {
    expect(isCheckRequired({ check_days: [1], required_periods: ['am'] }, monday, 'pm')).toBe(false)
  })

  it('uses defaults when item has no config', () => {
    // Default is all days and all periods — Monday + am should be required
    expect(isCheckRequired({}, monday, 'am')).toBe(true)
    expect(isCheckRequired({}, monday, 'pm')).toBe(true)
  })
})

describe('formatCheckDays', () => {
  it('returns "Every day" for all 7 days', () => {
    expect(formatCheckDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
  })

  it('returns "Every day" for default (null/empty)', () => {
    expect(formatCheckDays([])).toBe('Every day')
    expect(formatCheckDays(null)).toBe('Every day')
  })

  it('returns short day names for subset', () => {
    const result = formatCheckDays([1, 2, 3, 4, 5]) // Mon–Fri
    expect(result).toBe('Mon, Tue, Wed, Thu, Fri')
  })

  it('returns single day', () => {
    expect(formatCheckDays([3])).toBe('Wed')
  })

  it('handles weekend', () => {
    const result = formatCheckDays([6, 0]) // Sat, Sun
    expect(result).toBe('Sat, Sun')
  })
})

describe('formatRequiredPeriods', () => {
  it('returns "AM/PM" for both periods', () => {
    expect(formatRequiredPeriods(['am', 'pm'])).toBe('AM/PM')
  })

  it('returns "AM/PM" for default (null/empty)', () => {
    expect(formatRequiredPeriods([])).toBe('AM/PM')
    expect(formatRequiredPeriods(null)).toBe('AM/PM')
  })

  it('returns "AM" for am only', () => {
    expect(formatRequiredPeriods(['am'])).toBe('AM')
  })

  it('returns "PM" for pm only', () => {
    expect(formatRequiredPeriods(['pm'])).toBe('PM')
  })
})
