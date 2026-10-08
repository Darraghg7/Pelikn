import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useVenueFeatures } from '../useVenueFeatures'

// save() used to swallow every failure: the optimistic flip was rolled back
// and the caller had no way to know. It now resolves to the error.

vi.mock('../../contexts/VenueContext', () => ({
  useVenue: () => ({ venueId: 'venue-1', venueSlug: 'v', venuePlan: 'pro' }),
}))
vi.mock('../../lib/api/bootstrap', () => ({ takeBootstrapSettings: async () => undefined }))

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useVenueFeatures.save', () => {
  let upsertStatus
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    upsertStatus = 201
    global.fetch = vi.fn(async (url, init) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      const method = init?.method ?? 'GET'
      if (u.includes('/rest/v1/app_settings') && method === 'GET') {
        return json({ value: JSON.stringify({ mode: 'all', enabled: [], extras: [] }) })
      }
      if (u.includes('/rest/v1/app_settings')) {
        return upsertStatus >= 400
          ? json({ code: '42501', message: 'new row violates row-level security policy' }, upsertStatus)
          : new Response(null, { status: upsertStatus })
      }
      return json([])
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('resolves to the error when the database refuses the write', async () => {
    upsertStatus = 403
    const { result } = renderHook(() => useVenueFeatures(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    let outcome
    await act(async () => { outcome = await result.current.setExtra('recall', true) })
    expect(outcome).toBeInstanceOf(Error)
    expect(outcome.message).toMatch(/row-level security/)
    // Rolled back: the extra is not shown as on.
    await waitFor(() => expect(result.current.isSwitchedOn('recall')).toBe(false))
  })

  it('resolves to null when the write succeeds', async () => {
    const { result } = renderHook(() => useVenueFeatures(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    let outcome
    await act(async () => { outcome = await result.current.setExtra('recall', true) })
    expect(outcome).toBeNull()
  })
})
