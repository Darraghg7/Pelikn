import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAppSettings } from '../useSettings'

const VENUE = 'venue-1'

vi.mock('../../contexts/VenueContext', () => ({
  useVenue: () => ({ venueId: VENUE, venueSlug: 'v', venueName: 'V', venuePlan: 'pro' }),
}))
vi.mock('../../components/ui/Toast', () => ({ useToast: () => null }))

const json = (body) =>
  new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })

// What the venue has actually configured — deliberately different from
// DEFAULTS on both fields that feed useTodaySummary's cache key.
const CONFIGURED = [
  { key: 'closed_days', value: JSON.stringify([0]) },
  { key: 'action_schedules', value: JSON.stringify({ fridge_checks: { enabled: false, days: [] } }) },
]

/** A fresh provider per mount — stands in for a cold app open. */
function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useAppSettings — cold-start persistence', () => {
  let settingsFetches

  beforeEach(() => {
    localStorage.clear()
    settingsFetches = 0
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/app_settings')) {
        settingsFetches++
        return json(CONFIGURED)
      }
      return json([])
    })
  })
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('falls back to defaults on a first-ever open, then persists what it fetched', async () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper })

    // Nothing on disk yet — defaults are all we can honestly show.
    expect(result.current.closedDays).toEqual([])

    await waitFor(() => expect(result.current.closedDays).toEqual([0]))
    expect(JSON.parse(localStorage.getItem(`pelikn_settings_${VENUE}`)).closedDays).toEqual([0])
  })

  it('renders the venue’s real settings on the first paint of a cold open', async () => {
    // Warm the cache the way a previous session would have.
    const { unmount } = renderHook(() => useAppSettings(), { wrapper })
    await waitFor(() => expect(localStorage.getItem(`pelikn_settings_${VENUE}`)).toBeTruthy())
    unmount()

    // Cold open: new QueryClient, so React Query has nothing in memory. This is
    // the render that used to hand back DEFAULTS and make the Today tiles fetch
    // their snapshot a second time once the real settings landed.
    const { result } = renderHook(() => useAppSettings(), { wrapper })

    expect(result.current.closedDays).toEqual([0])
    expect(result.current.actionSchedules.fridge_checks).toEqual({ enabled: false, days: [] })
  })

  it('does not show one venue the previous venue’s settings', async () => {
    localStorage.setItem('pelikn_settings_some-other-venue', JSON.stringify({ closedDays: [3] }))

    const { result } = renderHook(() => useAppSettings(), { wrapper })

    // The entry is scoped to a different venue, so it must read as a miss.
    expect(result.current.closedDays).toEqual([])
  })

  it('survives a corrupt cache entry', async () => {
    localStorage.setItem(`pelikn_settings_${VENUE}`, '{not json')

    const { result } = renderHook(() => useAppSettings(), { wrapper })

    expect(result.current.closedDays).toEqual([])
    await waitFor(() => expect(result.current.closedDays).toEqual([0]))
  })
})
