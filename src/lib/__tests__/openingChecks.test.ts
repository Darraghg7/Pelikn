import { describe, it, expect } from 'vitest'
import { isCheckDueOn, checksDueOn, dateFromISO } from '../openingChecks'

const MONDAY = dateFromISO('2026-10-19')
const TUESDAY = dateFromISO('2026-10-20')

describe('openingChecks', () => {
  it('treats missing or empty check_days as every day', () => {
    expect(isCheckDueOn({}, MONDAY)).toBe(true)
    expect(isCheckDueOn({ check_days: null }, MONDAY)).toBe(true)
    expect(isCheckDueOn({ check_days: [] }, TUESDAY)).toBe(true)
  })

  it('uses 0=Sun..6=Sat', () => {
    const tueToSat = { check_days: [2, 3, 4, 5, 6] }
    expect(isCheckDueOn(tueToSat, MONDAY)).toBe(false)
    expect(isCheckDueOn(tueToSat, TUESDAY)).toBe(true)
  })

  it('filters a list and keeps order', () => {
    const list = [{ id: 'a', check_days: [1] }, { id: 'b', check_days: [2] }, { id: 'c' }]
    expect(checksDueOn(list, MONDAY).map(c => c.id)).toEqual(['a', 'c'])
  })

  it('parses a day string as a local date', () => {
    expect(dateFromISO('2026-10-19').getDay()).toBe(1)
  })
})
