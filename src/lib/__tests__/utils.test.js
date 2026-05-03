import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatTemp,
  formatDate,
  formatDateTime,
  isTempOutOfRange,
  getWeekStart,
  getWeekDays,
  capitalize,
  formatMinutes,
  slugify,
  staffColour,
} from '../utils'

// Fixed date for stable assertions
const FIXED_DATE = new Date('2024-06-10T12:00:00Z')

describe('formatTemp', () => {
  it('formats an integer to one decimal place with °C', () => {
    expect(formatTemp(3)).toBe('3.0°C')
  })

  it('formats a float to one decimal place', () => {
    expect(formatTemp(4.7)).toBe('4.7°C')
  })

  it('formats a string number', () => {
    expect(formatTemp('2.5')).toBe('2.5°C')
  })

  it('formats zero', () => {
    expect(formatTemp(0)).toBe('0.0°C')
  })

  it('formats negative temperatures', () => {
    expect(formatTemp(-18)).toBe('-18.0°C')
  })
})

describe('isTempOutOfRange', () => {
  it('returns false when temp is exactly at min', () => {
    expect(isTempOutOfRange(0, 0, 5)).toBe(false)
  })

  it('returns false when temp is exactly at max', () => {
    expect(isTempOutOfRange(5, 0, 5)).toBe(false)
  })

  it('returns false when temp is within range', () => {
    expect(isTempOutOfRange(3, 0, 5)).toBe(false)
  })

  it('returns true when temp is below min', () => {
    expect(isTempOutOfRange(-1, 0, 5)).toBe(true)
  })

  it('returns true when temp is above max', () => {
    expect(isTempOutOfRange(6, 0, 5)).toBe(true)
  })

  it('coerces string values', () => {
    expect(isTempOutOfRange('10', '0', '5')).toBe(true)
    expect(isTempOutOfRange('3', '0', '5')).toBe(false)
  })
})

describe('capitalize', () => {
  it('capitalises the first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('leaves the rest unchanged', () => {
    expect(capitalize('hELLO')).toBe('HELLO')
  })

  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('')
  })

  it('returns empty string for falsy input', () => {
    expect(capitalize(null)).toBe('')
    expect(capitalize(undefined)).toBe('')
  })
})

describe('formatMinutes', () => {
  it('returns "0m" for zero', () => {
    expect(formatMinutes(0)).toBe('0m')
  })

  it('returns "0m" for negative values', () => {
    expect(formatMinutes(-10)).toBe('0m')
  })

  it('returns "0m" for null/undefined', () => {
    expect(formatMinutes(null)).toBe('0m')
    expect(formatMinutes(undefined)).toBe('0m')
  })

  it('formats minutes only (under an hour)', () => {
    expect(formatMinutes(45)).toBe('45m')
  })

  it('formats exactly one hour', () => {
    expect(formatMinutes(60)).toBe('1h 0m')
  })

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m')
  })

  it('formats multiple hours', () => {
    expect(formatMinutes(150)).toBe('2h 30m')
  })
})

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Nomad City Centre')).toBe('nomad-city-centre')
  })

  it('strips special characters', () => {
    expect(slugify("O'Briens Café")).toBe('obriens-caf')
  })

  it('collapses multiple spaces and hyphens', () => {
    expect(slugify('Foo   Bar--Baz')).toBe('foo-bar-baz')
  })

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
  })

  it('truncates to 50 characters', () => {
    const long = 'a'.repeat(60)
    expect(slugify(long)).toHaveLength(50)
  })

  it('handles an already-slugified string', () => {
    expect(slugify('my-venue-slug')).toBe('my-venue-slug')
  })
})

describe('getWeekStart', () => {
  it('returns the Monday of the given week', () => {
    // 2024-06-10 is a Monday
    const monday = getWeekStart(new Date('2024-06-10'))
    expect(monday.getDay()).toBe(1)
  })

  it('returns Monday when given a Wednesday mid-week', () => {
    // 2024-06-12 is a Wednesday
    const result = getWeekStart(new Date('2024-06-12'))
    expect(result.getDay()).toBe(1)
  })

  it('returns Monday when given a Sunday', () => {
    // 2024-06-16 is a Sunday
    const result = getWeekStart(new Date('2024-06-16'))
    expect(result.getDay()).toBe(1)
  })
})

describe('getWeekDays', () => {
  it('returns an array of 7 dates', () => {
    const start = new Date('2024-06-10') // Monday
    const days = getWeekDays(start)
    expect(days).toHaveLength(7)
  })

  it('starts on Monday', () => {
    const start = new Date('2024-06-10')
    const days = getWeekDays(start)
    expect(days[0].getDay()).toBe(1)
  })

  it('ends on Sunday', () => {
    const start = new Date('2024-06-10')
    const days = getWeekDays(start)
    expect(days[6].getDay()).toBe(0)
  })

  it('days are consecutive', () => {
    const start = new Date('2024-06-10')
    const days = getWeekDays(start)
    for (let i = 1; i < 7; i++) {
      const diff = (days[i] - days[i - 1]) / (1000 * 60 * 60 * 24)
      expect(diff).toBe(1)
    }
  })
})

describe('staffColour', () => {
  it('returns the staff member\'s saved colour if set', () => {
    const staff = { id: 'abc', colour: '#ff0000' }
    expect(staffColour(staff)).toBe('#ff0000')
  })

  it('returns a colour from the palette when no saved colour', () => {
    const staff = { id: '550e8400-e29b-41d4-a716-446655440000', colour: null }
    const result = staffColour(staff)
    expect(result).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('returns the same colour deterministically for the same ID', () => {
    const staff = { id: '550e8400-e29b-41d4-a716-446655440000', colour: null }
    expect(staffColour(staff)).toBe(staffColour(staff))
  })

  it('handles staff with no id', () => {
    const staff = { colour: null }
    const result = staffColour(staff)
    expect(typeof result).toBe('string')
  })
})
