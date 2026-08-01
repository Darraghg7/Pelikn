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
