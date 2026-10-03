import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState, useCallback } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const { mockRpc, mockToast } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockToast: vi.fn() }))

vi.mock('../../../lib/offlineSupabase', () => ({ offlineRpc: mockRpc }))
vi.mock('../../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'v1' }) }))
vi.mock('../../ui/Toast', () => ({ useToast: () => mockToast }))
vi.mock('../../../hooks/useClockAlerts', () => ({
  useClockAlerts: () => ({ onClockEvent: async () => {}, alertModalProps: { open: false } }),
}))
vi.mock('../../../hooks/useClosingCheckoutGuard', () => ({
  useClosingCheckoutGuard: ({ onProceed }) => ({ guardClockOut: onProceed, modalProps: { open: false } }),
}))
vi.mock('../ClosingChecklistGateModal', () => ({ default: () => null }))
vi.mock('../StaffAlertModal', () => ({ default: () => null }))

// Real nextClockStatus; useClockStatus replaced by plain state so the test
// sees exactly what the panel writes and nothing re-reads the server.
vi.mock('../../../hooks/useClockEvents', async (importActual) => {
  const actual = await importActual()
  return {
    ...actual,
    useClockStatus: () => {
      const [s, set] = useState({ status: 'clocked_out', clockInAt: null, breakStartAt: null, totalBreakMs: 0 })
      const setStatus = useCallback(async (next) => set(next), [])
      return { ...s, loading: false, isError: false, reload: () => {}, setStatus }
    },
  }
})

import ClockPanel from '../ClockPanel'

/** An RPC that doesn't answer until the test says so — a slow mobile connection. */
function slowRpc() {
  let resolve
  mockRpc.mockImplementation(() => new Promise((r) => { resolve = r }))
  return (result) => act(async () => { resolve(result) })
}

beforeEach(() => vi.clearAllMocks())

describe('ClockPanel taps', () => {
  it('shows the new state on the tap, before the server answers', async () => {
    const answer = slowRpc()
    render(<ClockPanel staffId="s1" />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clock In' })) })

    // Server hasn't replied, but the buttons have already moved on.
    expect(screen.getByRole('button', { name: 'Start Break' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clock In' })).toBeNull()
    expect(mockToast).not.toHaveBeenCalled()

    await answer({ data: 'id', error: null })
    expect(screen.getByRole('button', { name: 'Start Break' })).toBeTruthy()
    expect(mockToast).toHaveBeenCalledWith('Clocked in')
  })

  it('puts the old state back if the server refuses', async () => {
    const answer = slowRpc()
    render(<ClockPanel staffId="s1" />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clock In' })) })
    expect(screen.getByRole('button', { name: 'Start Break' })).toBeTruthy()

    await answer({ data: null, error: { message: 'Not signed in to this venue' } })
    expect(screen.getByRole('button', { name: 'Clock In' })).toBeTruthy()
    expect(mockToast).toHaveBeenCalledWith('Not signed in to this venue', 'error')
  })

  it('ignores a second tap while the first is still on its way', async () => {
    const answer = slowRpc()
    render(<ClockPanel staffId="s1" />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clock In' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Break' })) })
    expect(mockRpc).toHaveBeenCalledTimes(1)

    await answer({ data: 'id', error: null })
    expect(screen.getByRole('button', { name: 'Start Break' })).toBeTruthy()
  })
})
