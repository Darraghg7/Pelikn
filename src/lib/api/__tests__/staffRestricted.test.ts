import { describe, it, expect, beforeEach, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../../supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))
const reportError = vi.fn()
vi.mock('../../reportError', () => ({ reportError: (...args: unknown[]) => reportError(...args) }))

import {
  fetchStaffPayRates,
  fetchStaffPrivateFields,
  getRestrictedFieldsFailures,
  subscribeRestrictedFieldsFailures,
  resetRestrictedFieldsFailures,
  classifyRestrictedFieldsError,
} from '../staffRestricted'
import { SESSION_TOKEN_KEY } from '../../constants'

describe('classifyRestrictedFieldsError', () => {
  it('reads 145\'s 42501 as a session problem', () => {
    expect(classifyRestrictedFieldsError({ code: '42501', message: 'Unauthorized: no active session' })).toBe('session')
  })
  it('reads the pre-145 P0001 "no active session" as a session problem too', () => {
    // The exact error in the 8 Oct 2026 Postgres log.
    expect(classifyRestrictedFieldsError({ code: 'P0001', message: 'Unauthorized: no active session' })).toBe('session')
  })
  it('reads a missing function as an unapplied migration', () => {
    expect(classifyRestrictedFieldsError({ code: 'PGRST202', message: 'Could not find the function' })).toBe('missing')
  })
  it('treats anything else as a plain fault', () => {
    expect(classifyRestrictedFieldsError({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe('error')
  })
})

describe('load failures are recorded, not swallowed', () => {
  beforeEach(() => {
    rpc.mockReset()
    reportError.mockReset()
    resetRestrictedFieldsFailures()
    localStorage.setItem(SESSION_TOKEN_KEY, 'tok-1')
  })

  it('records a dead-session pay failure, reports it, and still returns an empty map', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Unauthorized: no active session' } })
    const listener = vi.fn()
    const unsubscribe = subscribeRestrictedFieldsFailures(listener)

    const rates = await fetchStaffPayRates()

    expect(rates.size).toBe(0)
    expect(getRestrictedFieldsFailures().get('pay')).toBe('session')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ code: 'P0001' }), 'staffRestricted:staff_pay_rates')
    unsubscribe()
  })

  it('clears the failure once a later load succeeds', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Unauthorized: no active session' } })
    await fetchStaffPayRates()
    expect(getRestrictedFieldsFailures().has('pay')).toBe(true)

    rpc.mockResolvedValueOnce({ data: [{ staff_id: 's1', hourly_rate: 12.5 }], error: null })
    const rates = await fetchStaffPayRates()

    expect(rates.get('s1')).toBe(12.5)
    expect(getRestrictedFieldsFailures().has('pay')).toBe(false)
  })

  it('tracks private fields separately from pay', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } })
    await fetchStaffPrivateFields()

    expect(getRestrictedFieldsFailures().get('private')).toBe('missing')
    expect(getRestrictedFieldsFailures().has('pay')).toBe(false)
    expect(reportError).toHaveBeenCalledWith(expect.anything(), 'staffRestricted:staff_private_fields')
  })

  it('does not notify listeners when nothing changed', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeRestrictedFieldsFailures(listener)
    rpc.mockResolvedValue({ data: [], error: null })
    await fetchStaffPayRates()
    await fetchStaffPrivateFields()
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
