import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable stand-in for the Supabase query builder: every call is recorded and
// awaiting it yields whatever the test queued for that table.
const results: Record<string, { data: unknown; error: unknown }> = {}
const calls: Array<{ table: string; method: string; args: unknown[] }> = []

function builder(table: string) {
  const b: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(results[table] ?? { data: [{ id: 'x' }], error: null })
      }
      return (...args: unknown[]) => { calls.push({ table, method: prop, args }); return b }
    },
  })
  return b
}
vi.mock('../../supabase', () => ({ supabase: { from: (t: string) => builder(t) } }))

import { insertRow, updateRowById, errorOf } from '../writes'
import { finishCoolingBatch, discardCoolingBatch } from '../cooling'
import { insertPestLog, markPestIssueResolved } from '../pestControl'
import { deactivateFridge, updateFridge, setFridgeLogReason } from '../fridges'
import { deactivateHotHoldingItem } from '../hotHolding'
import { fetchProbeCalibrations } from '../probe'
import { fetchWasteForExport } from '../waste'

const scoped = (venue: string) =>
  calls.some(c => c.method === 'eq' && c.args[0] === 'venue_id' && c.args[1] === venue)

beforeEach(() => {
  for (const k of Object.keys(results)) delete results[k]
  calls.length = 0
})

describe('writes', () => {
  it('insertRow throws the database error', async () => {
    results.waste_logs = { data: null, error: new Error('nope') }
    await expect(insertRow('waste_logs', {})).rejects.toThrow('nope')
  })

  it('updateRowById scopes to venue and id and asks for the row back', async () => {
    await updateRowById('fridges', 'f1', { name: 'A' }, 'v-1', 'gone')
    expect(scoped('v-1')).toBe(true)
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === 'f1')).toBe(true)
    expect(calls.some(c => c.method === 'select' && c.args[0] === 'id')).toBe(true)
  })

  it('updateRowById throws when no row changed', async () => {
    results.fridges = { data: [], error: null }
    await expect(updateRowById('fridges', 'f1', {}, 'v-1', 'That fridge no longer exists')).rejects.toThrow('no longer exists')
  })

  it('errorOf gives the message, or null on success', async () => {
    expect(await errorOf(Promise.resolve())).toBeNull()
    expect(await errorOf(Promise.reject({ message: 'bad' }))).toEqual({ message: 'bad' })
  })

  it('removing a fridge, item or issue fails loudly when nothing matched', async () => {
    results.fridges = { data: [], error: null }
    results.hot_holding_items = { data: [], error: null }
    results.pest_control_logs = { data: [], error: null }
    await expect(deactivateFridge('v-1', 'f1')).rejects.toThrow()
    await expect(updateFridge('v-1', 'f1', {})).rejects.toThrow()
    await expect(deactivateHotHoldingItem('v-1', 'h1')).rejects.toThrow()
    await expect(markPestIssueResolved('v-1', 'p1')).rejects.toThrow()
  })

  it('setFridgeLogReason is venue-scoped', async () => {
    await setFridgeLogReason('v-1', 'l1', 'delivery')
    expect(scoped('v-1')).toBe(true)
  })
})

describe('cooling', () => {
  it('finish reports false when another device finished it first', async () => {
    results.cooling_logs = { data: [], error: null }
    expect(await finishCoolingBatch('v-1', 'b1', { end_temp: 5, finished_at: 'x', notes: null })).toBe(false)
    expect(calls.some(c => c.method === 'is' && c.args[0] === 'end_temp')).toBe(true)
    expect(scoped('v-1')).toBe(true)
  })

  it('finish reports true when the row changed', async () => {
    expect(await finishCoolingBatch('v-1', 'b1', { end_temp: 5, finished_at: 'x', notes: null })).toBe(true)
  })

  it('discard throws when the batch is already finished', async () => {
    results.cooling_logs = { data: [], error: null }
    await expect(discardCoolingBatch('v-1', 'b1')).rejects.toThrow('already finished')
  })
})

describe('pest control', () => {
  it('retries without issue_id before migration 121, naming the issue in the text', async () => {
    let n = 0
    const inserted: any[] = []
    const orig = results.pest_control_logs
    Object.defineProperty(results, 'pest_control_logs', {
      configurable: true,
      get() { n++; return n === 1 ? { data: null, error: new Error('column issue_id does not exist') } : { data: null, error: null } },
    })
    await insertPestLog({ issue_id: 'i1', description: 'Seen again', venue_id: 'v-1' }, 'Mice')
    inserted.push(...calls.filter(c => c.method === 'insert').map(c => c.args[0]))
    expect(inserted).toHaveLength(2)
    expect(inserted[1]).toEqual({ description: 'Re: Mice — Seen again', venue_id: 'v-1' })
    delete (results as any).pest_control_logs
    if (orig) results.pest_control_logs = orig
  })

  it('does not retry an unrelated error', async () => {
    results.pest_control_logs = { data: null, error: new Error('permission denied') }
    await expect(insertPestLog({ issue_id: 'i1', description: 'x' }, 'Mice')).rejects.toThrow('permission denied')
    expect(calls.filter(c => c.method === 'insert')).toHaveLength(1)
  })
})

describe('reads', () => {
  it('probe calibrations are venue-scoped and throw on failure', async () => {
    await fetchProbeCalibrations('v-1')
    expect(scoped('v-1')).toBe(true)
    results.probe_calibrations = { data: null, error: new Error('boom') }
    await expect(fetchProbeCalibrations('v-1')).rejects.toThrow('boom')
  })

  it('waste export is venue-scoped and throws on failure', async () => {
    await fetchWasteForExport('v-1', '2026-10-01', '2026-10-11')
    expect(scoped('v-1')).toBe(true)
    results.waste_logs = { data: null, error: new Error('boom') }
    await expect(fetchWasteForExport('v-1', 'a', 'b')).rejects.toThrow('boom')
  })
})
