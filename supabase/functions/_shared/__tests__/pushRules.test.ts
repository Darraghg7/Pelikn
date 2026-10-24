import { describe, expect, it } from 'vitest'
import { planPush, safeAppPath, venuePath } from '../pushRules'

const base = { notificationType: 'time_off_request', title: 'Leave request', body: 'Lucy asked for 9–10 Nov' }

describe('safeAppPath', () => {
  it('keeps in-app paths', () => {
    expect(safeAppPath('/time-off')).toBe('/time-off')
    expect(safeAppPath('/rota?week=2026-10-19')).toBe('/rota?week=2026-10-19')
  })

  it('turns links to other sites into the home path', () => {
    for (const url of ['https://evil.example', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', 'time-off', '', null, 42]) {
      expect(safeAppPath(url)).toBe('/')
    }
  })
})

describe('venuePath', () => {
  it('scopes bare paths to the venue', () => {
    expect(venuePath('/timesheet', 'nomad')).toBe('/v/nomad/timesheet')
    expect(venuePath('/', 'nomad')).toBe('/v/nomad/dashboard')
  })

  it('leaves venue paths and unknown venues alone', () => {
    expect(venuePath('/v/nomad/rota', 'other')).toBe('/v/nomad/rota')
    expect(venuePath('/rota', null)).toBe('/rota')
  })
})

describe('planPush', () => {
  it('lets staff notify their managers', () => {
    const plan = planPush({ ...base, callerRole: 'staff' })
    expect(plan).toMatchObject({ ok: true, roles: ['manager', 'owner'], staffIds: [] })
  })

  it('stops staff messaging named people or the whole team', () => {
    expect(planPush({ ...base, callerRole: 'staff', staffIds: ['owner-id'] })).toMatchObject({ ok: false, status: 403 })
    expect(planPush({ ...base, callerRole: 'staff', roles: ['staff'] })).toMatchObject({ ok: false, status: 403 })
  })

  it('lets managers notify named people', () => {
    expect(planPush({ ...base, callerRole: 'manager', staffIds: ['a', 'b'] })).toMatchObject({ ok: true, staffIds: ['a', 'b'] })
  })

  it('refuses unknown or missing notification types', () => {
    expect(planPush({ ...base, callerRole: 'owner', notificationType: undefined })).toMatchObject({ ok: false, status: 400 })
    expect(planPush({ ...base, callerRole: 'owner', notificationType: 'payroll_issue' })).toMatchObject({ ok: false, status: 400 })
  })

  it('refuses unknown roles and caps long text', () => {
    expect(planPush({ ...base, callerRole: 'owner', roles: ['admin'] })).toMatchObject({ ok: false, status: 400 })
    const plan = planPush({ ...base, callerRole: 'owner', title: 'x'.repeat(500), body: 'y'.repeat(500) })
    expect(plan.ok && plan.title.length).toBe(100)
    expect(plan.ok && plan.body.length).toBe(300)
  })

  it('ignores anything in the request that claims a role', () => {
    // The role always comes from the session lookup; a body field must not matter.
    const forged = { ...base, staffIds: ['owner-id'], callerRole: 'owner' }
    expect(planPush({ ...forged, callerRole: 'staff' })).toMatchObject({ ok: false, status: 403 })
  })

  it('treats a caller with no known role as staff', () => {
    expect(planPush({ ...base, callerRole: null, staffIds: ['x'] })).toMatchObject({ ok: false, status: 403 })
  })
})
