import { describe, it, expect, vi, beforeEach } from 'vitest'

const results: Record<string, { data?: unknown; error?: unknown; count?: number }> = {}
const calls: Array<{ table: string; method: string; args: unknown[] }> = []

function builder(table: string) {
  const b: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(results[table] ?? { data: [], error: null, count: 0 })
      }
      return (...args: unknown[]) => { calls.push({ table, method: prop, args }); return b }
    },
  })
  return b
}
vi.mock('../../supabase', () => ({ supabase: { from: (t: string) => builder(t) } }))

import { fetchHACCPPlan, saveHACCPPlan, fetchHACCPSummary } from '../haccp'

beforeEach(() => {
  for (const k of Object.keys(results)) delete results[k]
  calls.length = 0
})

describe('HACCP plan', () => {
  it('reads by venue and throws on error', async () => {
    results.haccp_plans = { data: { id: 'p1' }, error: null }
    expect(await fetchHACCPPlan('v-1')).toEqual({ id: 'p1' })
    results.haccp_plans = { data: null, error: new Error('x') }
    await expect(fetchHACCPPlan('v-1')).rejects.toThrow('x')
  })

  it('first save inserts as incomplete; later saves update by id and venue', async () => {
    results.haccp_plans = { data: [{ id: 'p1' }], error: null }
    await saveHACCPPlan('v-1', undefined, { business_name: 'B' })
    expect(calls.find(c => c.method === 'insert')!.args[0]).toMatchObject({ venue_id: 'v-1', is_complete: false })
    calls.length = 0
    await saveHACCPPlan('v-1', 'p1', { business_name: 'B' })
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === 'p1')).toBe(true)
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'venue_id' && c.args[1] === 'v-1')).toBe(true)
  })

  it('an update that matched nothing is an error, not a saved plan', async () => {
    results.haccp_plans = { data: [], error: null }
    await expect(saveHACCPPlan('v-1', 'p1', {})).rejects.toThrow(/could not be saved/)
  })
})

describe('HACCP summary', () => {
  it('counts records for the venue', async () => {
    results.fridge_temperature_logs = { count: 12, error: null }
    const s = await fetchHACCPSummary('v-1')
    expect(s.fridgeCount).toBe(12)
    expect(s.cookingCount).toBe(0)
    expect(calls.filter(c => c.method === 'eq' && c.args[0] === 'venue_id')).toHaveLength(6)
  })

  it('throws instead of reporting "no records" when a count fails', async () => {
    results.cooking_temp_logs = { count: undefined, error: new Error('down') }
    await expect(fetchHACCPSummary('v-1')).rejects.toThrow('down')
  })
})
