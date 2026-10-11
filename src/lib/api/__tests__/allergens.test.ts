import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable stand-in for the Supabase query builder: awaiting it yields what
// the test queued for that table.
const results: Record<string, { data?: unknown; error?: unknown; count?: number }> = {}
const calls: Array<{ table: string; method: string; args: unknown[] }> = []
const rpc = vi.fn()

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
vi.mock('../../supabase', () => ({ supabase: { from: (t: string) => builder(t), rpc: (...a: unknown[]) => rpc(...a) } }))

import {
  fetchFoodItems, setFoodItemActive, replaceFoodItemAllergens, updateFoodItemMayContain,
  createFoodItem, addFoodItemAllergens, fetchPPDSItems, deletePPDSItem, setPPDSItemActive,
  savePPDSItem, fetchAllergenProcedure, saveAllergenProcedure,
} from '../allergens'

const scoped = (venue = 'v-1') =>
  calls.some(c => c.method === 'eq' && c.args[0] === 'venue_id' && c.args[1] === venue)

beforeEach(() => {
  for (const k of Object.keys(results)) delete results[k]
  calls.length = 0
  rpc.mockReset()
})

describe('food items', () => {
  it('reads are venue-scoped and hide inactive dishes unless asked', async () => {
    await fetchFoodItems('v-1', 'soup')
    expect(scoped()).toBe(true)
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'is_active')).toBe(true)
    expect(calls.some(c => c.method === 'ilike')).toBe(true)
    calls.length = 0
    await fetchFoodItems('v-1', '', true)
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'is_active')).toBe(false)
  })

  it('throws when the read fails', async () => {
    results.food_items = { data: null, error: new Error('boom') }
    await expect(fetchFoodItems('v-1')).rejects.toThrow('boom')
  })

  it('hiding a dish asks for the row back and is venue-scoped', async () => {
    results.food_items = { data: [{ id: 'f1' }], error: null }
    await setFoodItemActive('v-1', 'f1', false)
    expect(scoped()).toBe(true)
    expect(calls.some(c => c.method === 'select' && c.args[0] === 'id')).toBe(true)
  })

  it('does not report success when no row was changed', async () => {
    results.food_items = { data: [], error: null }
    await expect(setFoodItemActive('v-1', 'f1', false)).rejects.toThrow(/could not be saved/)
    await expect(updateFoodItemMayContain('v-1', 'f1', ['Milk'], '')).rejects.toThrow(/could not be saved/)
  })

  it('edits through the replace_food_item_allergens RPC with the session token', async () => {
    rpc.mockResolvedValue({ error: null })
    await replaceFoodItemAllergens({ sessionToken: 'tok', venueId: 'v-1', id: 'f1', name: 'Soup', description: '', allergens: ['Milk'] })
    expect(rpc).toHaveBeenCalledWith('replace_food_item_allergens', {
      p_session_token: 'tok', p_food_item_id: 'f1', p_venue_id: 'v-1',
      p_name: 'Soup', p_description: null, p_allergens: ['Milk'],
    })
  })

  it('throws the RPC error', async () => {
    rpc.mockResolvedValue({ error: new Error('denied') })
    await expect(replaceFoodItemAllergens({ sessionToken: 't', venueId: 'v-1', id: 'f1', name: 'x', description: '', allergens: [] })).rejects.toThrow('denied')
  })

  it('stores an empty may-contain list as null', async () => {
    results.food_items = { data: [{ id: 'f1' }], error: null }
    await updateFoodItemMayContain('v-1', 'f1', [], '  ')
    const upd = calls.find(c => c.method === 'update')!
    expect(upd.args[0]).toEqual({ may_contain_allergens: null, verbal_confirmation_note: null })
  })

  it('creates a dish in the venue and tags each allergen with it', async () => {
    results.food_items = { data: { id: 'f9' }, error: null }
    const row = await createFoodItem('v-1', { name: 'Soup', description: '', mayContain: [], verbalNote: '' })
    expect(row.id).toBe('f9')
    expect((calls.find(c => c.method === 'insert')!.args[0] as any).venue_id).toBe('v-1')
    calls.length = 0
    await addFoodItemAllergens('v-1', 'f9', ['Milk', 'Eggs'])
    expect(calls.find(c => c.method === 'insert')!.args[0]).toEqual([
      { food_item_id: 'f9', allergen: 'Milk', venue_id: 'v-1' },
      { food_item_id: 'f9', allergen: 'Eggs', venue_id: 'v-1' },
    ])
  })

  it('adding no allergens makes no call', async () => {
    await addFoodItemAllergens('v-1', 'f9', [])
    expect(calls).toHaveLength(0)
  })
})

describe('PPDS items', () => {
  it('reads are venue-scoped and throw on error', async () => {
    await fetchPPDSItems('v-1')
    expect(scoped()).toBe(true)
    results.ppds_items = { data: null, error: new Error('nope') }
    await expect(fetchPPDSItems('v-1')).rejects.toThrow('nope')
  })

  it('delete and toggle fail loudly when no row matched', async () => {
    results.ppds_items = { data: [], error: null }
    await expect(deletePPDSItem('v-1', 'p1')).rejects.toThrow(/could not be saved/)
    await expect(setPPDSItemActive('v-1', 'p1', false)).rejects.toThrow(/could not be saved/)
  })

  it('save creates without an id and updates scoped by id and venue', async () => {
    results.ppds_items = { data: [{ id: 'p1' }], error: null }
    const input = { name: 'Cake', description: null, ingredients: [{ name: 'Flour', allergen: 'Gluten' }], may_contain_allergens: [] }
    await savePPDSItem('v-1', undefined, input)
    expect(calls.some(c => c.method === 'insert')).toBe(true)
    calls.length = 0
    await savePPDSItem('v-1', 'p1', input)
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === 'p1')).toBe(true)
    expect(scoped()).toBe(true)
    expect(calls.find(c => c.method === 'update')!.args[0]).toMatchObject({ venue_id: 'v-1', is_active: true })
  })
})

describe('allergen procedure', () => {
  it('reads null when the venue has none yet, and throws on error', async () => {
    results.allergen_procedures = { data: null, error: null }
    expect(await fetchAllergenProcedure('v-1')).toBeNull()
    results.allergen_procedures = { data: null, error: new Error('x') }
    await expect(fetchAllergenProcedure('v-1')).rejects.toThrow('x')
  })

  it('creates the first one and updates later ones by venue', async () => {
    results.allergen_procedures = { data: [{ venue_id: 'v-1' }], error: null }
    await saveAllergenProcedure('v-1', false, { procedure_text: 'a' })
    expect(calls.some(c => c.method === 'insert')).toBe(true)
    calls.length = 0
    await saveAllergenProcedure('v-1', true, { procedure_text: 'a' })
    expect(scoped()).toBe(true)
    // this table has no id column; asking for one would 400
    expect(calls.some(c => c.method === 'select' && c.args[0] === 'venue_id')).toBe(true)
  })

  it('an update that matched nothing is an error', async () => {
    results.allergen_procedures = { data: [], error: null }
    await expect(saveAllergenProcedure('v-1', true, {})).rejects.toThrow(/could not be saved/)
  })
})
