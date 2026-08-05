import { describe, it, expect } from 'vitest'
import { timeOffPermissions, isBlocking } from '../api/timeOff'

const TODAY = '2026-08-05'

const request = (over = {}) => ({
  id: 'r1',
  staff_id: 'staff-1',
  start_date: '2026-08-20',
  end_date: '2026-08-24',
  leave_type: 'annual',
  status: 'pending',
  ...over,
})

const asOwner = { staffId: 'staff-1', isManager: false, today: TODAY }
const asManager = { staffId: 'mgr-1', isManager: true, today: TODAY }
const asColleague = { staffId: 'staff-2', isManager: false, today: TODAY }

describe('isBlocking', () => {
  it('holds the staff member off the rota while pending or approved', () => {
    expect(isBlocking('pending')).toBe(true)
    expect(isBlocking('approved')).toBe(true)
  })

  it('frees them once withdrawn or rejected', () => {
    expect(isBlocking('cancelled')).toBe(false)
    expect(isBlocking('rejected')).toBe(false)
  })
})

describe('timeOffPermissions', () => {
  it('lets staff edit and withdraw their own pending request', () => {
    const p = timeOffPermissions(request(), asOwner)
    expect(p).toMatchObject({ canEdit: true, canCancel: true, needsReapproval: false })
  })

  // The point of the feature: approved leave can be handed back, which is what
  // frees the staff member up to be rota'd again.
  it('lets staff withdraw their own approved leave, and re-approves on edit', () => {
    const p = timeOffPermissions(request({ status: 'approved' }), asOwner)
    expect(p).toMatchObject({ canEdit: true, canCancel: true, needsReapproval: true })
  })

  it('stops staff changing leave that has already started', () => {
    const p = timeOffPermissions(request({ start_date: '2026-08-01', end_date: '2026-08-07' }), asOwner)
    expect(p.canCancel).toBe(false)
    expect(p.lockedReason).toMatch(/already started/i)
  })

  it('still lets a manager change leave that has started', () => {
    const p = timeOffPermissions(request({ start_date: '2026-08-01', status: 'approved' }), asManager)
    expect(p).toMatchObject({ canEdit: true, canCancel: true, needsReapproval: false })
  })

  it('gives colleagues no actions on someone else’s leave', () => {
    expect(timeOffPermissions(request(), asColleague)).toMatchObject({ canEdit: false, canCancel: false })
  })

  it('leaves manager-logged history to managers', () => {
    const p = timeOffPermissions(request({ status: 'approved', is_manual_entry: true }), asOwner)
    expect(p.canCancel).toBe(false)
    expect(p.lockedReason).toMatch(/logged by a manager/i)
  })

  it('offers nothing on an already-withdrawn or rejected request', () => {
    expect(timeOffPermissions(request({ status: 'cancelled' }), asManager).canCancel).toBe(false)
    expect(timeOffPermissions(request({ status: 'rejected' }), asManager).canEdit).toBe(false)
  })
})
