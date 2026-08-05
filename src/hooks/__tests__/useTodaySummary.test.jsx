import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTodaySummary, invalidateSummaryCache } from '../useTodaySummary'
import { supabase } from '../../lib/supabase'

const VENUE = 'venue-1'

function snapshot(overrides = {}) {
  return {
    closureReason: null, isClosed: false,
    overdueClean: 0, onShiftToday: 0,
    checksToday: 0, closingChecksToday: 0, totalChecks: 5,
    uncheckedFridges: 0, totalFridges: 0,
    pendingLeave: 0, criticalActions: 0,
    cookingTempsToday: 0, hotHoldingToday: 0, coolingLogsToday: 0,
    dutiesAssigned: 0, dutiesCompleted: 0,
    ...overrides,
  }
}

const json = (body) =>
  new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })

describe('useTodaySummary — refreshing after a write', () => {
  // What the snapshot RPC currently answers. Reassigned mid-test to stand in
  // for the row a completed check would have added.
  let serverSnapshot
  let rpcCalls

  beforeEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    serverSnapshot = snapshot()
    rpcCalls = 0
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/rpc/get_dashboard_snapshot')) {
        rpcCalls++
        return json(serverSnapshot)
      }
      return json([])
    })
  })
  afterEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('reads the real numbers from the snapshot RPC', async () => {
    // Regression: fetchOnce() called .finally() straight on the supabase query
    // builder, which is a thenable with no .finally. The TypeError was caught
    // and turned into an all-zeros summary, so every tile read 0 — a venue with
    // overdue cleans looked spotless.
    serverSnapshot = snapshot({ checksToday: 4, overdueClean: 7, uncheckedFridges: 2 })
    const { result } = renderHook(() => useTodaySummary(VENUE, [], {}))

    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(result.current.summary).toMatchObject({
      checksToday: 4, overdueClean: 7, uncheckedFridges: 2,
    })
    expect(rpcCalls).toBe(1)
  })

  it('serves concurrent mounts from a single RPC', async () => {
    // The coalescing fetchOnce() exists for — three components mount this hook
    // on the manager dashboard in the same tick.
    const a = renderHook(() => useTodaySummary(VENUE, [], {}))
    const b = renderHook(() => useTodaySummary(VENUE, [], {}))
    const c = renderHook(() => useTodaySummary(VENUE, [], {}))

    await waitFor(() => {
      expect(a.result.current.summary).not.toBeNull()
      expect(b.result.current.summary).not.toBeNull()
      expect(c.result.current.summary).not.toBeNull()
    })
    expect(rpcCalls).toBe(1)
  })

  it('falls back to the multi-query path when the snapshot RPC is missing', async () => {
    // Databases without migration 095 have no get_dashboard_snapshot. The RPC
    // 404s and the original per-table queries run instead — that path has to
    // produce real numbers too, not the all-zeros the TypeError used to yield.
    global.fetch = vi.fn(async (url, options = {}) => {
      const u = String(url)
      const method = (options.method ?? 'GET').toUpperCase()
      if (u.includes('/rpc/get_dashboard_snapshot')) {
        return new Response(JSON.stringify({ message: 'function does not exist' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        })
      }
      // Counted queries (head: true) carry their result in content-range.
      const counted = (n) => new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'content-range': `*/${n}` },
      })
      if (method === 'HEAD') {
        if (u.includes('/shifts')) return counted(6)
        if (u.includes('session_type=eq.opening')) return counted(4)
        if (u.includes('/time_off_requests')) return counted(2)
        return counted(0)
      }
      return json([])
    })

    const { result } = renderHook(() => useTodaySummary(VENUE, [], {}))

    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(result.current.summary).toMatchObject({
      onShiftToday: 6,
      checksToday: 4,
      pendingLeave: 2,
    })
  })

  it('re-fetches when a completed check is written, without falling back to skeletons', async () => {
    const { result } = renderHook(() => useTodaySummary(VENUE, [], {}))

    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(result.current.summary.checksToday).toBe(0)
    expect(rpcCalls).toBe(1)

    // The check is marked off. This is the write that used to leave the tile
    // showing 0 — the cache was inside its 20 s fresh window, so nothing refetched.
    serverSnapshot = snapshot({ checksToday: 3 })
    await supabase.from('opening_closing_completions').insert({ check_id: 'c1' })

    await waitFor(() => expect(result.current.summary.checksToday).toBe(3))
    expect(rpcCalls).toBe(2)
    // The previous numbers stayed on screen throughout the refresh.
    expect(result.current.loading).toBe(false)
  })

  it('ignores writes to tables the summary does not count', async () => {
    const { result } = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(rpcCalls).toBe(1)

    await supabase.from('staff_disciplinary_log').insert({ strike_number: 1 })

    await new Promise(r => setTimeout(r, 400))  // past the coalescing window
    expect(rpcCalls).toBe(1)
  })

  it('coalesces a burst of writes into a single refetch', async () => {
    const { result } = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(rpcCalls).toBe(1)

    // Marking off a checklist writes one row per item.
    serverSnapshot = snapshot({ checksToday: 5 })
    for (const id of ['c1', 'c2', 'c3', 'c4', 'c5']) {
      await supabase.from('opening_closing_completions').insert({ check_id: id })
    }

    await waitFor(() => expect(result.current.summary.checksToday).toBe(5))
    await new Promise(r => setTimeout(r, 400))
    expect(rpcCalls).toBe(2)
  })

  it('a write drops the cache, so a screen mounting afterwards refetches too', async () => {
    const first = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(first.result.current.summary).not.toBeNull())
    first.unmount()

    serverSnapshot = snapshot({ criticalActions: 2 })
    await supabase.from('corrective_actions').insert({ severity: 'critical' })

    // Remounting immediately — well inside the 20 s window that previously
    // served the pre-write numbers with no request at all.
    const second = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(second.result.current.summary?.criticalActions).toBe(2))
  })
})

describe('useTodaySummary — action schedules', () => {
  let serverSnapshot
  let rpcCalls

  beforeEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    serverSnapshot = snapshot({ uncheckedFridges: 3, totalFridges: 4 })
    rpcCalls = 0
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/rpc/get_dashboard_snapshot')) {
        rpcCalls++
        return json(serverSnapshot)
      }
      return json([])
    })
  })
  afterEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    vi.restoreAllMocks()
  })

  const NOT_DUE = { fridge_checks: { enabled: false, days: [] } }

  it('re-gates the tiles when a schedule changes', async () => {
    const { result, rerender } = renderHook(
      ({ sched }) => useTodaySummary(VENUE, [], sched),
      { initialProps: { sched: {} } },
    )

    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(result.current.summary.uncheckedFridges).toBe(3)

    // Fridge checks switched off for today in Settings. The summary reports a
    // check that isn't due as zero — which it could not do before, because the
    // effect never re-ran on a schedule change.
    rerender({ sched: NOT_DUE })
    await waitFor(() => expect(result.current.summary.uncheckedFridges).toBe(0))
  })

  it('does not serve one schedule the other schedule’s numbers', async () => {
    const { result, rerender } = renderHook(
      ({ sched }) => useTodaySummary(VENUE, [], sched),
      { initialProps: { sched: {} } },
    )
    await waitFor(() => expect(result.current.summary?.uncheckedFridges).toBe(3))

    rerender({ sched: NOT_DUE })
    await waitFor(() => expect(result.current.summary.uncheckedFridges).toBe(0))

    // Straight back — well inside the 20 s fresh window. The two gatings must
    // hold separate cache entries, or this reads the zeroed one.
    rerender({ sched: {} })
    await waitFor(() => expect(result.current.summary.uncheckedFridges).toBe(3))
  })

  it('does not re-fetch when the schedules object is rebuilt unchanged', async () => {
    // useAppSettings returns a fresh object every render and callers pass
    // literals, so the effect is keyed on the gating those schedules produce,
    // not on their identity. Getting this wrong is an infinite fetch loop.
    const { result, rerender } = renderHook(
      ({ sched }) => useTodaySummary(VENUE, [], sched),
      { initialProps: { sched: { fridge_checks: { enabled: true, days: [0,1,2,3,4,5,6] } } } },
    )
    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(rpcCalls).toBe(1)

    for (let i = 0; i < 5; i++) {
      rerender({ sched: { fridge_checks: { enabled: true, days: [0,1,2,3,4,5,6] } } })
    }

    await new Promise(r => setTimeout(r, 100))
    expect(rpcCalls).toBe(1)
  })
})

describe('useTodaySummary — keeping a left-open dashboard live', () => {
  let serverSnapshot
  let rpcCalls

  beforeEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    serverSnapshot = snapshot()
    rpcCalls = 0
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/rpc/get_dashboard_snapshot')) {
        rpcCalls++
        return json(serverSnapshot)
      }
      return json([])
    })
  })
  afterEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    setVisibility('visible')
    vi.restoreAllMocks()
  })

  function setVisibility(state) {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => state,
    })
  }

  async function mounted() {
    const h = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(h.result.current.summary).not.toBeNull())
    expect(rpcCalls).toBe(1)
    return h
  }

  it('re-fetches when the tab becomes visible again and the cache cannot serve it', async () => {
    const { result } = await mounted()

    // Stand in for data that is no longer usable — a day rolled over, or the
    // entry aged out. Previously nothing re-ran at all: the tiles only ever
    // fetched on mount, so a dashboard left open never moved.
    serverSnapshot = snapshot({ onShiftToday: 9 })
    invalidateSummaryCache(null)
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(result.current.summary.onShiftToday).toBe(9))
  })

  it('re-fetches on window focus', async () => {
    const { result } = await mounted()

    serverSnapshot = snapshot({ criticalActions: 4 })
    invalidateSummaryCache(null)
    window.dispatchEvent(new Event('focus'))

    await waitFor(() => expect(result.current.summary.criticalActions).toBe(4))
  })

  it('costs nothing while the cached numbers are still fresh', async () => {
    await mounted()

    // The revalidation nudge is deliberately unconditional; the fetch effect
    // is what decides. Inside the fresh window that decision is "no request".
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))

    await new Promise(r => setTimeout(r, 100))
    expect(rpcCalls).toBe(1)
  })

  it('does not fetch for a hidden tab', async () => {
    await mounted()

    setVisibility('hidden')
    invalidateSummaryCache(null)
    document.dispatchEvent(new Event('visibilitychange'))

    await new Promise(r => setTimeout(r, 100))
    expect(rpcCalls).toBe(1)
  })
})

describe('useTodaySummary — live updates', () => {
  let serverSnapshot
  let rpcCalls
  let bindings
  let channelNames
  let removed
  let statusCb

  function fakeChannel(name) {
    channelNames.push(name)
    const ch = {
      on: (event, cfg, cb) => { bindings.push({ event, ...cfg, cb }); return ch },
      subscribe: (cb) => { statusCb = cb; cb?.('SUBSCRIBED'); return ch },
    }
    return ch
  }

  /** Fire a postgres_changes event for `table`, as the server would. */
  function emit(table) {
    for (const b of bindings.filter(b => b.table === table)) b.cb({ eventType: 'INSERT' })
  }

  beforeEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    serverSnapshot = snapshot()
    rpcCalls = 0
    bindings = []
    channelNames = []
    removed = []
    statusCb = null
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/rpc/get_dashboard_snapshot')) {
        rpcCalls++
        return json(serverSnapshot)
      }
      return json([])
    })
    vi.spyOn(supabase, 'channel').mockImplementation(fakeChannel)
    vi.spyOn(supabase, 'removeChannel').mockImplementation((c) => { removed.push(c) })
  })
  afterEach(() => {
    invalidateSummaryCache(null)
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('watches every summary table, scoped to the venue', async () => {
    const h = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(h.result.current.summary).not.toBeNull())

    expect(channelNames).toEqual([`today-summary:${VENUE}`])
    expect(bindings.length).toBeGreaterThan(0)
    // Every binding is venue-scoped — without the filter a client would be
    // handed every other venue's operational data over the socket.
    for (const b of bindings) {
      expect(b.filter).toBe(`venue_id=eq.${VENUE}`)
      expect(b.schema).toBe('public')
    }
    const watched = bindings.map(b => b.table)
    expect(watched).toContain('fridge_temperature_logs')
    expect(watched).toContain('opening_closing_completions')
    expect(watched).toContain('shifts')
    // No venue_id column to filter on, so it must not be watched.
    expect(watched).not.toContain('duty_template_items')

    h.unmount()
  })

  it('updates the tiles when another device logs something', async () => {
    const h = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(h.result.current.summary).not.toBeNull())
    expect(h.result.current.summary.uncheckedFridges).toBe(0)

    // A chef logs a fridge temp on their phone. Nothing happened on this
    // device — only the server can tell us, which is the whole point.
    serverSnapshot = snapshot({ uncheckedFridges: 2 })
    emit('fridge_temperature_logs')

    await waitFor(() => expect(h.result.current.summary.uncheckedFridges).toBe(2))
    h.unmount()
  })

  it('coalesces a burst of events into one refetch', async () => {
    const h = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(h.result.current.summary).not.toBeNull())
    expect(rpcCalls).toBe(1)

    serverSnapshot = snapshot({ checksToday: 5 })
    for (let i = 0; i < 6; i++) emit('opening_closing_completions')

    await waitFor(() => expect(h.result.current.summary.checksToday).toBe(5))
    await new Promise(r => setTimeout(r, 400))
    expect(rpcCalls).toBe(2)
    h.unmount()
  })

  it('shares one subscription across the hooks on a dashboard', async () => {
    const a = renderHook(() => useTodaySummary(VENUE, [], {}))
    const b = renderHook(() => useTodaySummary(VENUE, [], {}))
    const c = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(a.result.current.summary).not.toBeNull())

    expect(channelNames).toHaveLength(1)

    // Released only once the last one goes.
    a.unmount(); b.unmount()
    expect(removed).toHaveLength(0)
    c.unmount()
    expect(removed).toHaveLength(1)
  })

  it('reports the channel status so the backstop knows to take over', async () => {
    const h = renderHook(() => useTodaySummary(VENUE, [], {}))
    await waitFor(() => expect(h.result.current.summary).not.toBeNull())

    // The subscribe callback is how the poll learns whether it is the update
    // path or just a safety net. It has to be wired for that to work.
    expect(typeof statusCb).toBe('function')
    expect(() => statusCb('CHANNEL_ERROR')).not.toThrow()
    h.unmount()
  })
})
