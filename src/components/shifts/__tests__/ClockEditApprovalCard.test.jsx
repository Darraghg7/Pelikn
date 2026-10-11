import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const { mockFrom, mockReport } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockReport: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({ supabase: { from: mockFrom, rpc: vi.fn() } }))
vi.mock('../../../lib/reportError', () => ({ reportError: mockReport }))
vi.mock('../../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'v1' }) }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => ({ session: { staffId: 'm1' } }) }))
vi.mock('../../ui/Toast', () => ({ useToast: () => vi.fn() }))

import ClockEditApprovalCard from '../ClockEditApprovalCard'

/** A Supabase query builder: every filter returns itself, awaiting it gives `result`. */
function answers(...results) {
  for (const result of results) {
    const builder = new Proxy({}, {
      get: (_, key) => key === 'then'
        ? (resolve) => resolve(result)
        : () => builder,
    })
    mockFrom.mockImplementationOnce(() => builder)
  }
}

const REQUEST = {
  id: 'r1', status: 'pending', created_at: '2026-10-07T10:00:00Z', reason: 'Forgot to clock out',
  original_clock_in: '2026-10-07T09:00:00Z', original_clock_out: null,
  requested_clock_in: '2026-10-07T09:00:00Z', requested_clock_out: '2026-10-07T17:00:00Z',
  break_minutes: 30, staff: { name: 'Sam' },
}

beforeEach(() => vi.clearAllMocks())

describe('ClockEditApprovalCard', () => {
  it('stays hidden when nothing is pending', async () => {
    answers({ data: [], error: null })
    const { container } = await act(async () => render(<ClockEditApprovalCard />))
    expect(container.textContent).toBe('')
    expect(mockReport).not.toHaveBeenCalled()
  })

  it('shows a retry, not nothing, when the read fails — and recovers on retry', async () => {
    answers(
      { data: null, error: { message: 'permission denied for table clock_edit_requests', code: '42501' } },
      { data: [REQUEST], error: null },
    )
    await act(async () => { render(<ClockEditApprovalCard />) })

    expect(screen.getByRole('alert').textContent).toContain('Couldn’t load hour edit requests')
    expect(mockReport).toHaveBeenCalledWith(
      expect.objectContaining({ code: '42501' }),
      'ClockEditApprovalCard:load',
    )

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Sam')).toBeTruthy()
  })
})
