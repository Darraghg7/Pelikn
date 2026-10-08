import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({ supabase: { from: mockFrom } }))
vi.mock('../../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'v1' }) }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => ({ session: { staffId: 's1' }, isManager: false }) }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => vi.fn() }))

import NoticeBoardPage from '../NoticeBoardPage'

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

const FAILED = { data: null, error: { message: 'JWT expired', code: 'PGRST301' } }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><NoticeBoardPage /></QueryClientProvider>)
}

beforeEach(() => vi.clearAllMocks())

describe('NoticeBoardPage', () => {
  it('says "No notices yet" only when the read succeeded', async () => {
    serve({ noticeboard_posts: [{ data: [], error: null }] })
    renderPage()
    expect(await screen.findByText('No notices yet')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a retry instead of the empty state when the read fails', async () => {
    serve({
      noticeboard_posts: [FAILED, { data: [{ id: 'n1', title: 'Rota is up', body: 'Next week is published', pinned: false, created_at: '2026-10-08T09:00:00Z' }], error: null }],
    })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Couldn’t load notices')
    expect(screen.queryByText('No notices yet')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Rota is up')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
