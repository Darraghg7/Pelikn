import { describe, it, expect } from 'vitest'
import { roleMatcher } from '../roleFilter'

const VENUE_ROLE_IDS = ['foh-id', 'barista-id', 'manager-id']

describe('roleMatcher', () => {
  it('shows a staff member their own role and untargeted records', () => {
    const matches = roleMatcher(['foh-id'], VENUE_ROLE_IDS)
    expect(matches('foh-id')).toBe(true)
    expect(matches(null)).toBe(true)
    expect(matches(undefined)).toBe(true)
  })

  it('hides records targeted at another configured role', () => {
    const matches = roleMatcher(['foh-id'], VENUE_ROLE_IDS)
    expect(matches('barista-id')).toBe(false)
    expect(matches('manager-id')).toBe(false)
  })

  it('shows every role held by a staff member with more than one', () => {
    const matches = roleMatcher(['foh-id', 'barista-id'], VENUE_ROLE_IDS)
    expect(matches('foh-id')).toBe(true)
    expect(matches('barista-id')).toBe(true)
    expect(matches('manager-id')).toBe(false)
  })

  it('shows everything to a viewer with no roles assigned', () => {
    const matches = roleMatcher([], VENUE_ROLE_IDS)
    expect(matches('foh-id')).toBe(true)
    expect(matches('barista-id')).toBe(true)
  })

  it('shows everything to a viewer with a null role list (managers)', () => {
    const matches = roleMatcher(null, VENUE_ROLE_IDS)
    expect(matches('foh-id')).toBe(true)
    expect(matches('barista-id')).toBe(true)
  })

  // The reported bug this generalises: a staff member kept a role_id after
  // that role was deleted in Settings → Roles, so no task could ever match
  // and the module looked switched off — while the manager still saw everything.
  it('shows everything to a viewer whose only role the venue no longer has', () => {
    const matches = roleMatcher(['deleted-id'], VENUE_ROLE_IDS)
    expect(matches('foh-id')).toBe(true)
    expect(matches('barista-id')).toBe(true)
  })

  // Same drift from the other side: a record still targeting a deleted role.
  it('treats a record targeting a removed role as untargeted', () => {
    const matches = roleMatcher(['foh-id'], VENUE_ROLE_IDS)
    expect(matches('deleted-id')).toBe(true)
  })

  it('shows everything when the venue has no roles configured yet', () => {
    const matches = roleMatcher(['foh-id'], [])
    expect(matches('barista-id')).toBe(true)
  })
})
