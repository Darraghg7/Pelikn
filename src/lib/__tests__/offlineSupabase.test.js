import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures these are defined before the vi.mock factory runs
const { mockInsert, mockUpdate, mockUpsert, mockRpc } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpsert: vi.fn(),
  mockRpc:    vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
      upsert: mockUpsert,
    })),
    rpc: mockRpc,
  },
}))

import { offlineInsert, offlineRpc, syncQueue } from '../offlineSupabase'
import { getQueue, clearQueue, enqueue, enqueueRpc } from '../offlineQueue'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// ── offlineInsert ─────────────────────────────────────────────────────────────

describe('offlineInsert', () => {
  it('returns the supabase result on success', async () => {
    mockInsert.mockResolvedValue({ data: [{ id: 1 }], error: null })
    const result = await offlineInsert('fridge_logs', { temp: 3 })
    expect(result).toEqual({ data: [{ id: 1 }], error: null })
    expect(getQueue()).toHaveLength(0)
  })

  it('queues the operation and returns queued:true on network error (result.error)', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    const result = await offlineInsert('fridge_logs', { temp: 3 })
    expect(result).toEqual({ data: null, error: null, queued: true })
    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].table).toBe('fridge_logs')
    expect(queue[0].operation).toBe('insert')
  })

  it('queues the operation when supabase.from().insert() throws a network error', async () => {
    mockInsert.mockRejectedValue(new Error('network error'))
    const result = await offlineInsert('fridge_logs', { temp: 3 })
    expect(result.queued).toBe(true)
    expect(getQueue()).toHaveLength(1)
  })

  it('re-throws non-network errors', async () => {
    mockInsert.mockRejectedValue(new Error('Permission denied'))
    await expect(offlineInsert('fridge_logs', { temp: 3 })).rejects.toThrow('Permission denied')
    expect(getQueue()).toHaveLength(0)
  })

  it('queues when error message includes "offline"', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: 'offline' } })
    const result = await offlineInsert('table', {})
    expect(result.queued).toBe(true)
  })
})

// ── offlineRpc ────────────────────────────────────────────────────────────────

describe('offlineRpc', () => {
  it('returns the supabase result on success', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null })
    const result = await offlineRpc('my_fn', { id: 1 })
    expect(result).toEqual({ data: { ok: true }, error: null })
    expect(getQueue()).toHaveLength(0)
  })

  it('queues the RPC and returns queued:true on network error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    const result = await offlineRpc('my_fn', { id: 1 })
    expect(result.queued).toBe(true)
    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('rpc')
    expect(queue[0].fnName).toBe('my_fn')
  })

  it('queues on thrown network error', async () => {
    mockRpc.mockRejectedValue(new Error('load failed'))
    const result = await offlineRpc('my_fn', {})
    expect(result.queued).toBe(true)
  })

  it('re-throws non-network errors', async () => {
    mockRpc.mockRejectedValue(new Error('function does not exist'))
    await expect(offlineRpc('bad_fn', {})).rejects.toThrow()
  })
})

// ── syncQueue ─────────────────────────────────────────────────────────────────

describe('syncQueue', () => {
  it('returns { synced: 0, failed: 0 } when queue is empty', async () => {
    const result = await syncQueue()
    expect(result).toEqual({ synced: 0, failed: 0 })
  })

  it('syncs insert items and removes them from the queue', async () => {
    enqueue('fridge_logs', 'insert', { temp: 3 })
    mockInsert.mockResolvedValue({ error: null })
    const result = await syncQueue()
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(0)
    expect(getQueue()).toHaveLength(0)
  })

  it('syncs RPC items and removes them', async () => {
    enqueueRpc('my_fn', { id: 1 })
    mockRpc.mockResolvedValue({ error: null })
    const result = await syncQueue()
    expect(result.synced).toBe(1)
    expect(getQueue()).toHaveLength(0)
  })

  it('counts non-network server errors as failed and removes them', async () => {
    enqueue('fridge_logs', 'insert', { temp: 3 })
    mockInsert.mockResolvedValue({ error: { message: 'unique constraint violation' } })
    const result = await syncQueue()
    expect(result.failed).toBe(1)
    expect(result.synced).toBe(0)
    expect(getQueue()).toHaveLength(0)
  })

  it('leaves network-error items in the queue for next retry', async () => {
    enqueue('fridge_logs', 'insert', { temp: 3 })
    mockInsert.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    const result = await syncQueue()
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
    expect(getQueue()).toHaveLength(1)
  })

  it('handles a mix of successful, failed, and still-offline items', async () => {
    enqueue('table_a', 'insert', {})
    enqueue('table_b', 'insert', {})
    enqueueRpc('fn_c', {})

    // table_a → success, table_b → server error (removed), fn_c → still offline (kept)
    mockInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'bad data' } })
    mockRpc.mockResolvedValue({ error: { message: 'network' } })

    const result = await syncQueue()
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(1)
    expect(getQueue()).toHaveLength(1)
    expect(getQueue()[0].type).toBe('rpc')
  })
})
