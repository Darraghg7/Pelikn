import { describe, it, expect } from 'vitest'
import { roleMatcher } from '../roleFilter'

const VENUE_ROLES = ['foh', 'barista', 'manager']

describe('roleMatcher', () => {
  it('shows a staff member their own role and untargeted records', () => {
    const matches = roleMatcher('foh', VENUE_ROLES)
    expect(matches('foh')).toBe(true)
    expect(matches('all')).toBe(true)
    expect(matches(null)).toBe(true)
    expect(matches(undefined)).toBe(true)
  })

  it('hides records targeted at another configured role', () => {
    const matches = roleMatcher('foh', VENUE_ROLES)
    expect(matches('barista')).toBe(false)
    expect(matches('manager')).toBe(false)
  })

  it('shows everything to a viewer with no role set', () => {
    const matches = roleMatcher(null, VENUE_ROLES)
    expect(matches('foh')).toBe(true)
    expect(matches('barista')).toBe(true)
  })

  // The reported bug: a staff member kept job_role 'kitchen' after that role
  // was removed in Settings → Roles, so no task could ever match and the
  // module looked switched off — while the manager still saw every task.
  it('shows everything to a viewer whose role the venue no longer has', () => {
    const matches = roleMatcher('kitchen', VENUE_ROLES)
    expect(matches('foh')).toBe(true)
    expect(matches('barista')).toBe(true)
    expect(matches('all')).toBe(true)
  })

  // Same drift from the other side: a task still targeting a deleted role.
  it('treats a record targeting a removed role as untargeted', () => {
    const matches = roleMatcher('foh', VENUE_ROLES)
    expect(matches('kitchen')).toBe(true)
  })

  it('shows everything when the venue has no roles configured yet', () => {
    const matches = roleMatcher('foh', [])
    expect(matches('barista')).toBe(true)
    expect(matches('all')).toBe(true)
  })
})
