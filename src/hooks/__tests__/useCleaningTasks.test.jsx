import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const VENUE = 'venue-1'

vi.mock('../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'venue-1' }) }))
const settings = { closedDays: [], cleaningVisibleToAll: false }
vi.mock('../useSettings', () => ({ useAppSettings: () => settings }))
vi.mock('../useVenueClosures', () => ({ default: () => ({ closures: [] }) }))

const { useCleaningTasks, cleaningStatus, cleaningDueLabel } = await import('../useCleaningTasks')

const json = (body) =>
  new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })

const TASK = { id: 't1', title: 'Clean microwave', frequency: 'daily', department_id: null, is_active: true, venue_id: VENUE }

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

describe('cleaningDueLabel', () => {
  // Friday 25 Sep 2026, mid-afternoon.
  const NOW = new Date(2026, 8, 25, 15, 0)
  const task = (frequency) => ({ ...TASK, frequency })
  const done = (y, m, d, h = 10) => ({ id: 'c', cleaning_task_id: 't1', completed_at: new Date(y, m, d, h).toISOString(), venue_id: VENUE })
  const label = (frequency, completion) => {
    const t = task(frequency)
    return cleaningDueLabel(t, completion, cleaningStatus(t, completion, NOW), NOW)
  }

  it('flags a task that has never been done', () => {
    expect(label('weekly', null)).toEqual({ text: 'Never done', tone: 'danger' })
  })

  it('says a daily task is due today, not overdue, until the day is out', () => {
    expect(label('daily', done(2026, 8, 24))).toEqual({ text: 'Due today', tone: 'warning' })
    expect(label('daily', done(2026, 8, 22))).toEqual({ text: '2d overdue', tone: 'danger' })
    expect(label('daily', done(2026, 8, 25))).toEqual({ text: 'Due tomorrow', tone: 'muted' })
  })

  it('counts weekly tasks from the day they fell due', () => {
    // Done Thu 17 Sep: due Thu 24 Sep, so a day overdue on Fri 25.
    expect(label('weekly', done(2026, 8, 17))).toEqual({ text: '1d overdue', tone: 'danger' })
    // Done Fri 18 Sep: due today.
    expect(label('weekly', done(2026, 8, 18, 16))).toEqual({ text: 'Due today', tone: 'warning' })
    // Done Mon 21 Sep: due Mon 28 Sep.
    expect(label('weekly', done(2026, 8, 21))).toEqual({ text: 'Due Mon', tone: 'muted' })
  })

  it('gives a date once the due day is more than a week out', () => {
    expect(label('monthly', done(2026, 8, 20))).toEqual({ text: 'Due 20 Oct', tone: 'muted' })
  })

  it('says nothing when a closed day capped an overdue task at done', () => {
    expect(cleaningDueLabel(task('weekly'), done(2026, 8, 10), 'done', NOW)).toBeNull()
  })
})

describe('useCleaningTasks — department visibility', () => {
  let client
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const KITCHEN = { ...TASK, id: 'k1', title: 'Degrease fryer', department_id: 'kitchen' }
  const FOH     = { ...TASK, id: 'f1', title: 'Wipe tables',    department_id: 'foh' }

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/cleaning_tasks')) return json([KITCHEN, FOH])
      return json([])
    })
    vi.spyOn(supabase, 'channel').mockImplementation(() => {
      const ch = { on: () => ch, subscribe: () => ch }
      return ch
    })
    vi.spyOn(supabase, 'removeChannel').mockImplementation(() => {})
  })
  afterEach(() => {
    settings.cleaningVisibleToAll = false
    client.clear()
    vi.restoreAllMocks()
  })

  it('shows staff only their own department by default', async () => {
    const h = renderHook(() => useCleaningTasks(['foh'], ['kitchen', 'foh']), { wrapper })
    await waitFor(() => expect(h.result.current.loading).toBe(false))
    expect(h.result.current.tasks.map(t => t.id)).toEqual(['f1'])
  })

  it('shows staff every department when the venue opts in', async () => {
    settings.cleaningVisibleToAll = true
    const h = renderHook(() => useCleaningTasks(['foh'], ['kitchen', 'foh']), { wrapper })
    await waitFor(() => expect(h.result.current.tasks).toHaveLength(2))
  })

  it('shows staff with no department the whole schedule', async () => {
    const h = renderHook(() => useCleaningTasks([], ['kitchen', 'foh']), { wrapper })
    await waitFor(() => expect(h.result.current.loading).toBe(false))
    expect(h.result.current.tasks).toHaveLength(2)
  })
})
