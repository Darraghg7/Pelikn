import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockFrom, mockReport } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockReport: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: { from: mockFrom } }))
vi.mock('../../lib/reportError', () => ({ reportError: mockReport }))
vi.mock('../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: '0b8c6a52-1d1f-4f7e-9a51-6f1d2b7c9e10' }) }))

import { useDutyTemplates } from '../useDuties'
import { reportQueryError } from '../../lib/queryErrors'

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

const FAILED = { data: null, error: { message: 'permission denied for table duty_template_items', code: '42501' } }

describe('useDutyTemplates', () => {
  let client
  // Same QueryCache wiring as App.jsx, so the test covers the reporting too.
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({
      queryCache: new QueryCache({ onError: reportQueryError }),
      defaultOptions: { queries: { retry: false } },
    })
  })
  afterEach(() => client.clear())

  it('returns templates with their items when both reads succeed', async () => {
    serve({
      duty_templates: [{ data: [{ id: 't1', title: 'Close bar', created_at: '2026-10-01' }], error: null }],
      duty_template_items: [{ data: [{ id: 'i1', duty_template_id: 't1', title: 'Wipe taps', sort_order: 0 }], error: null }],
    })
    const { result } = renderHook(() => useDutyTemplates(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isError).toBe(false)
    expect(result.current.templates).toHaveLength(1)
    expect(result.current.templates[0].items.map(i => i.title)).toEqual(['Wipe taps'])
    expect(mockReport).not.toHaveBeenCalled()
  })

  it('fails the query instead of listing templates with no checklist items', async () => {
    // Before: the items read failing gave every duty an empty checklist.
    serve({
      duty_templates: [{ data: [{ id: 't1', title: 'Close bar', created_at: '2026-10-01' }], error: null }],
      duty_template_items: [FAILED],
    })
    const { result } = renderHook(() => useDutyTemplates(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.templates).toEqual([])
    expect(mockReport).toHaveBeenCalledTimes(1)
    expect(mockReport).toHaveBeenCalledWith(
      expect.objectContaining({ code: '42501' }),
      expect.objectContaining({ context: 'query:dutyTemplates' }),
    )
  })
})
