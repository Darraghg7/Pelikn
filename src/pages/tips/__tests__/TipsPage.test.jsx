import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const { mockFrom, mockReport } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockReport: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({ supabase: { from: mockFrom } }))
vi.mock('../../../lib/reportError', () => ({ reportError: mockReport }))
vi.mock('../../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'v1' }) }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => ({ session: { staffId: 'm1' }, isManager: true }) }))
vi.mock('../../../hooks/useVenueRoles', () => ({ useStaffJobTitles: () => ({ labelFor: () => '' }) }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))

import TipsPage from '../TipsPage'

/** Answer each supabase.from(table) with the next queued result for that table. */
function serve(byTable) {
  mockFrom.mockImplementation((table) => {
    const result = byTable[table].shift()
    const builder = new Proxy({}, {
      get: (_, key) => key === 'then' ? (resolve) => resolve(result) : () => builder,
    })
    return builder
  })
}

const FAILED = { data: null, error: { message: 'column tip_splits.split_date does not exist', code: '42703' } }

beforeEach(() => vi.clearAllMocks())

describe('TipsPage', () => {
  it('says "no tip splits yet" only when the read succeeded', async () => {
    serve({ tip_splits: [{ data: [], error: null }], staff: [{ data: [], error: null }] })
    await act(async () => { render(<TipsPage />) })
    expect(screen.getByText('No tip splits yet')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a retry instead of the empty state when the read fails', async () => {
    serve({
      tip_splits: [FAILED, { data: [], error: null }],
      staff: [{ data: [], error: null }],
    })
    await act(async () => { render(<TipsPage />) })

    expect(screen.queryByText('No tip splits yet')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t load tip splits')
    expect(mockReport).toHaveBeenCalledWith(expect.objectContaining({ code: '42703' }), 'TipsPage:splits')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('No tip splits yet')).toBeTruthy()
  })
})
