import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { useLeaveBalance } = await import('../useLeaveBalance')

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('useLeaveBalance', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/leave_entitlements')) return json(null)
      // Mon 5 – Sun 11 Oct 2026: a whole week off
      if (u.includes('/rest/v1/time_off_requests')) return json([{ start_date: '2026-10-05', end_date: '2026-10-11' }])
      return json([])
    })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('re-counts days used when the working pattern changes, without refetching', async () => {
    const monFri = { id: 's1', employment_type: 'full_time', working_days: [1, 2, 3, 4, 5] }
    const h = renderHook(({ staff }) => useLeaveBalance(staff, 2026), { initialProps: { staff: monFri } })
    await waitFor(() => expect(h.result.current.loading).toBe(false))
    expect(h.result.current.used).toBe(5)
    const fetches = global.fetch.mock.calls.length

    // A manager changes them to a three-day week — the old count used to stick
    // until a reload.
    h.rerender({ staff: { ...monFri, working_days: [5, 6, 7] } })
    expect(h.result.current.used).toBe(3)
    expect(global.fetch.mock.calls.length).toBe(fetches)
  })
})
