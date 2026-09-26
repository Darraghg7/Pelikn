import { describe, it, expect } from 'vitest'
import { departmentMatcher } from '../roleFilter'

const VENUE_DEPT_IDS = ['kitchen-id', 'foh-id', 'bar-id']

describe('departmentMatcher', () => {
  it('shows a staff member their own department and untargeted records', () => {
    const matches = departmentMatcher(['foh-id'], VENUE_DEPT_IDS)
    expect(matches('foh-id')).toBe(true)
    expect(matches(null)).toBe(true)
    expect(matches(undefined)).toBe(true)
  })

  it('hides records assigned to another department', () => {
    const matches = departmentMatcher(['foh-id'], VENUE_DEPT_IDS)
    expect(matches('kitchen-id')).toBe(false)
    expect(matches('bar-id')).toBe(false)
  })

  it('shows every department a staff member is in', () => {
    const matches = departmentMatcher(['foh-id', 'bar-id'], VENUE_DEPT_IDS)
    expect(matches('foh-id')).toBe(true)
    expect(matches('bar-id')).toBe(true)
    expect(matches('kitchen-id')).toBe(false)
  })

  it('shows everything to a viewer with no department', () => {
    const matches = departmentMatcher([], VENUE_DEPT_IDS)
    expect(matches('kitchen-id')).toBe(true)
    expect(matches('foh-id')).toBe(true)
  })

  it('shows everything to managers (null)', () => {
    const matches = departmentMatcher(null, VENUE_DEPT_IDS)
    expect(matches('kitchen-id')).toBe(true)
  })

  it('shows everything to a viewer whose only department was deleted', () => {
    const matches = departmentMatcher(['deleted-id'], VENUE_DEPT_IDS)
    expect(matches('kitchen-id')).toBe(true)
    expect(matches('foh-id')).toBe(true)
  })

  it('treats a record assigned to a removed department as untargeted', () => {
    const matches = departmentMatcher(['foh-id'], VENUE_DEPT_IDS)
    expect(matches('deleted-id')).toBe(true)
  })

  it('shows everything when the venue has no departments yet', () => {
    const matches = departmentMatcher(['foh-id'], [])
    expect(matches('kitchen-id')).toBe(true)
  })
})
