import { describe, it, expect, vi, beforeEach } from 'vitest'

// A chainable stand-in for the Supabase query builder: every method returns the
// builder, and awaiting it yields whatever the test queued for that table.
const results: Record<string, { data: unknown; error: unknown }> = {}
const calls: Array<{ table: string; method: string; args: unknown[] }> = []

function builder(table: string) {
  const b: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(results[table] ?? { data: [], error: null })
      }
      return (...args: unknown[]) => { calls.push({ table, method: prop, args }); return b }
    },
  })
  return b
}
vi.mock('../../supabase', () => ({ supabase: { from: (t: string) => builder(t), rpc: vi.fn() } }))
vi.mock('../staffRestricted', () => ({ fetchStaffPayRates: vi.fn(async () => new Map([['s1', 10]])) }))

import {
  fetchOpenActionsWidget,
  fetchComplianceScoreWidget,
  fetchPendingSwapsWidget,
  fetchWeeklyLabourInputs,
  fetchFridgeAlertsWidget,
} from '../widgets'

beforeEach(() => {
  for (const k of Object.keys(results)) delete results[k]
  calls.length = 0
})

describe('widget reads', () => {
  it('scope every read to the venue', async () => {
    results.corrective_actions = { data: [], error: null }
    await fetchOpenActionsWidget('v-1')
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'venue_id' && c.args[1] === 'v-1')).toBe(true)
  })

  it('counts critical and major open actions', async () => {
    results.corrective_actions = {
      data: [{ id: '1', severity: 'critical' }, { id: '2', severity: 'major' }, { id: '3', severity: 'minor' }],
      error: null,
    }
    expect(await fetchOpenActionsWidget('v-1')).toMatchObject({ total: 3, critical: 1, major: 1 })
  })

  it('throws instead of showing zero when the read fails', async () => {
    results.shift_swaps = { data: null, error: new Error('boom') }
    await expect(fetchPendingSwapsWidget('v-1')).rejects.toThrow('boom')
  })

  it('compliance score throws when any one of its reads fails', async () => {
    results.delivery_checks = { data: null, error: new Error('bad column') }
    await expect(fetchComplianceScoreWidget('v-1')).rejects.toThrow('bad column')
  })

  it('compliance score still comes back for a venue with no records', async () => {
    const r = await fetchComplianceScoreWidget('v-1')
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(Array.isArray(r.issueList)).toBe(true)
  })

  it('weekly labour hands back the shifts with the pay rates', async () => {
    results.shifts = { data: [{ staff_id: 's1', start_time: '09:00', end_time: '17:00' }], error: null }
    const r = await fetchWeeklyLabourInputs('v-1', '2026-10-05')
    expect(r.shifts).toHaveLength(1)
    expect(r.rates.get('s1')).toBe(10)
  })

  it('fridge alerts ignore explained and resolved readings', async () => {
    results.fridge_temperature_logs = {
      data: [
        { id: 'a', temperature: 12, is_resolved: false, exceedance_reason: null, fridge: { name: 'F1', min_temp: 0, max_temp: 5 } },
        { id: 'b', temperature: 12, is_resolved: true,  exceedance_reason: null, fridge: { name: 'F2', min_temp: 0, max_temp: 5 } },
        { id: 'c', temperature: 3,  is_resolved: false, exceedance_reason: null, fridge: { name: 'F3', min_temp: 0, max_temp: 5 } },
      ],
      error: null,
    }
    results.fridges = { data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null }
    expect(await fetchFridgeAlertsWidget('v-1', '2026-10-11')).toMatchObject({ total: 3, alerts: 1, fridgeCount: 3, checkedCount: 3 })
  })
})
