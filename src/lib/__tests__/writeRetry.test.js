import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { supabase, clearSessionJwt, registerJwtRefresher, safeToRepeat, isStorageWrite } from '../supabase'

const REST = 'https://x.supabase.co/rest/v1'
const fetchCalls = () => /** @type {import('vitest').Mock} */ (/** @type {unknown} */ (global.fetch)).mock.calls

describe('which writes may be repeated', () => {
  it('repeats updates, deletes and upserts, never a plain insert', () => {
    expect(safeToRepeat(`${REST}/shifts?id=eq.1`, 'PATCH')).toBe(true)
    expect(safeToRepeat(`${REST}/shifts?id=eq.1`, 'DELETE')).toBe(true)
    expect(safeToRepeat(`${REST}/app_settings?on_conflict=venue_id,key`, 'POST')).toBe(true)
    expect(safeToRepeat(`${REST}/fridge_temperature_logs`, 'POST')).toBe(false)
    expect(safeToRepeat(`${REST}/rpc/record_clock_event`, 'POST')).toBe(false)
  })

  it('recognises file uploads', () => {
    expect(isStorageWrite('https://x.supabase.co/storage/v1/object/hr-documents/a.pdf', 'POST')).toBe(true)
    expect(isStorageWrite('https://x.supabase.co/storage/v1/object/hr-documents/a.pdf', 'GET')).toBe(false)
    expect(isStorageWrite(`${REST}/shifts`, 'POST')).toBe(false)
  })
})

describe('a timed-out insert', () => {
  beforeEach(() => {
    clearSessionJwt()
    registerJwtRefresher(null)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = vi.fn(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }) })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('is sent once, not again: the first may already have been saved', async () => {
    await supabase.from('fridge_temperature_logs').insert({ temperature: 3 })
    expect(fetchCalls()).toHaveLength(1)
  })
})
