import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const rpc = vi.fn()
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...args) => rpc(...args) } }))
vi.mock('../../../lib/reportError', () => ({ reportError: vi.fn() }))
const signOut = vi.fn()
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => ({ session: { venueSlug: 'nomad' }, signOut }),
}))

import RestrictedFieldsNotice from '../RestrictedFieldsNotice'
import { fetchStaffPayRates, fetchStaffPrivateFields, resetRestrictedFieldsFailures } from '../../../lib/api/staffRestricted'
import { SESSION_TOKEN_KEY } from '../../../lib/constants'

const renderNotice = (props) =>
  render(<MemoryRouter><RestrictedFieldsNotice {...props} /></MemoryRouter>)

describe('RestrictedFieldsNotice', () => {
  beforeEach(() => {
    rpc.mockReset()
    signOut.mockReset()
    act(() => resetRestrictedFieldsFailures())
    localStorage.setItem(SESSION_TOKEN_KEY, 'tok-1')
  })

  it('shows nothing while pay loaded fine', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null })
    await act(async () => { await fetchStaffPayRates() })
    renderNotice({ fields: ['pay'] })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says pay is missing and offers a fresh sign-in when the session was refused', async () => {
    renderNotice({ fields: ['pay'] })
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Unauthorized: no active session' } })
    await act(async () => { await fetchStaffPayRates() })

    expect(screen.getByRole('alert').textContent).toMatch(/Pay rates couldn't be loaded/)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('asks for a refresh, not a sign-in, on an ordinary fault', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'timeout' } })
    await act(async () => { await fetchStaffPrivateFields() })
    renderNotice({ fields: ['pay', 'private'] })

    expect(screen.getByRole('alert').textContent).toMatch(/Contract details couldn't be loaded.*Refresh the page/)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ignores failures in field sets the screen does not show', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'timeout' } })
    await act(async () => { await fetchStaffPrivateFields() })
    renderNotice({ fields: ['pay'] })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
