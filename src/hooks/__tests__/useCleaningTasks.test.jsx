import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const VENUE = 'venue-1'

vi.mock('../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'venue-1' }) }))
vi.mock('../useSettings', () => ({ useAppSettings: () => ({ closedDays: [] }) }))
vi.mock('../useVenueClosures', () => ({ default: () => ({ closures: [] }) }))

const { useCleaningTasks } = await import('../useCleaningTasks')

const json = (body) =>
  new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })

const TASK = { id: 't1', title: 'Clean microwave', frequency: 'daily', role_id: null, is_active: true, venue_id: VENUE }

describe('useCleaningTasks — live updates', () => {
  let completions
  let bindings
  let channelNames
  let removed
  let client

  function fakeChannel(name) {
    channelNames.push(name)
    const ch = {
      on: (event, cfg, cb) => { bindings.push({ event, ...cfg, cb }); return ch },
      subscribe: (cb) => { cb?.('SUBSCRIBED'); return ch },
    }
    return ch
  }

  function emit(table) {
    for (const b of bindings.filter(b => b.table === table)) b.cb({ eventType: 'INSERT' })
  }

  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
    completions = []
    bindings = []
    channelNames = []
    removed = []
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/cleaning_tasks')) return json([TASK])
      if (u.includes('/rest/v1/cleaning_completions')) return json(completions)
      return json([])
    })
    vi.spyOn(supabase, 'channel').mockImplementation(fakeChannel)
    vi.spyOn(supabase, 'removeChannel').mockImplementation((c) => { removed.push(c) })
  })
  afterEach(() => {
    client.clear()
    vi.restoreAllMocks()
  })

  it('shows a task ticked on another device without a remount', async () => {
    // Regression: the manager's /cleaning list and sidebar badge only refetched
    // on remount, so a task a staff member ticked on their phone stayed
    // overdue on the manager's screen.
    const h = renderHook(() => useCleaningTasks(), { wrapper })
    await waitFor(() => expect(h.result.current.tasks).toHaveLength(1))
    expect(h.result.current.tasks[0].status).toBe('overdue')

    completions = [{
      id: 'c1', cleaning_task_id: 't1', completed_at: new Date().toISOString(),
      completed_by_name: 'Helen', venue_id: VENUE,
    }]
    emit('cleaning_completions')

    await waitFor(() => expect(h.result.current.tasks[0].status).toBe('done'))
    expect(h.result.current.overdueCount).toBe(0)
    h.unmount()
  })

  it('watches both tables, scoped to the venue', async () => {
    const h = renderHook(() => useCleaningTasks(), { wrapper })
    await waitFor(() => expect(h.result.current.tasks).toHaveLength(1))

    expect(channelNames).toEqual([`cleaning:${VENUE}`])
    expect(bindings.map(b => b.table).sort()).toEqual(['cleaning_completions', 'cleaning_tasks'])
    for (const b of bindings) expect(b.filter).toBe(`venue_id=eq.${VENUE}`)
    h.unmount()
  })

  it('shares one subscription between the badge and the page', async () => {
    const a = renderHook(() => useCleaningTasks(), { wrapper })
    const b = renderHook(() => useCleaningTasks(), { wrapper })
    await waitFor(() => expect(a.result.current.tasks).toHaveLength(1))

    expect(channelNames).toHaveLength(1)
    a.unmount()
    expect(removed).toHaveLength(0)
    b.unmount()
    expect(removed).toHaveLength(1)
  })

  it('neither fetches nor subscribes when disabled', async () => {
    const h = renderHook(() => useCleaningTasks(null, [], undefined, { enabled: false }), { wrapper })
    await new Promise(r => setTimeout(r, 50))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(channelNames).toHaveLength(0)
    expect(h.result.current.overdueCount).toBe(0)
    h.unmount()
  })
})
