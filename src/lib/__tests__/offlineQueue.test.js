import { describe, it, expect, beforeEach } from 'vitest'
import {
  getQueue,
  enqueue,
  enqueueRpc,
  dequeue,
  clearQueue,
  queueCount,
} from '../offlineQueue'

// jsdom provides localStorage — reset before each test
beforeEach(() => {
  localStorage.clear()
})

describe('getQueue', () => {
  it('returns empty array when nothing queued', () => {
    expect(getQueue()).toEqual([])
  })

  it('returns empty array when localStorage has invalid JSON', () => {
    localStorage.setItem('pelikn_offline_queue', 'not-json')
    expect(getQueue()).toEqual([])
  })
})

describe('enqueue', () => {
  it('adds an item to the queue', () => {
    enqueue('fridge_logs', 'insert', { temp: 3 })
    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].table).toBe('fridge_logs')
    expect(queue[0].operation).toBe('insert')
    expect(queue[0].payload).toEqual({ temp: 3 })
  })

  it('adds a unique id and timestamp to each item', () => {
    enqueue('fridge_logs', 'insert', { temp: 3 })
    const item = getQueue()[0]
    expect(typeof item.id).toBe('string')
    expect(item.id.length).toBeGreaterThan(0)
    expect(typeof item.timestamp).toBe('string')
  })

  it('accumulates multiple items in order', () => {
    enqueue('fridge_logs', 'insert', { temp: 1 })
    enqueue('cleaning_tasks', 'update', { done: true })
    const queue = getQueue()
    expect(queue).toHaveLength(2)
    expect(queue[0].table).toBe('fridge_logs')
    expect(queue[1].table).toBe('cleaning_tasks')
  })

  it('sets type to "table"', () => {
    enqueue('waste_logs', 'insert', {})
    expect(getQueue()[0].type).toBe('table')
  })
})

describe('enqueueRpc', () => {
  it('adds an RPC item to the queue', () => {
    enqueueRpc('mark_task_done', { task_id: 'abc' })
    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('rpc')
    expect(queue[0].fnName).toBe('mark_task_done')
    expect(queue[0].args).toEqual({ task_id: 'abc' })
  })

  it('assigns a unique id', () => {
    enqueueRpc('fn_a', {})
    enqueueRpc('fn_b', {})
    const [a, b] = getQueue()
    expect(a.id).not.toBe(b.id)
  })
})

describe('dequeue', () => {
  it('removes the item with the matching id', () => {
    enqueue('table_a', 'insert', {})
    enqueue('table_b', 'insert', {})
    const [first] = getQueue()
    dequeue(first.id)
    const remaining = getQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].table).toBe('table_b')
  })

  it('does nothing when id does not exist', () => {
    enqueue('table_a', 'insert', {})
    dequeue('nonexistent-id')
    expect(getQueue()).toHaveLength(1)
  })
})

describe('clearQueue', () => {
  it('empties the queue', () => {
    enqueue('table_a', 'insert', {})
    enqueue('table_b', 'insert', {})
    clearQueue()
    expect(getQueue()).toEqual([])
  })

  it('is idempotent on an already-empty queue', () => {
    clearQueue()
    clearQueue()
    expect(getQueue()).toEqual([])
  })
})

describe('queueCount', () => {
  it('returns 0 for an empty queue', () => {
    expect(queueCount()).toBe(0)
  })

  it('returns the correct count after enqueuing', () => {
    enqueue('a', 'insert', {})
    enqueue('b', 'insert', {})
    expect(queueCount()).toBe(2)
  })

  it('decrements after dequeue', () => {
    enqueue('a', 'insert', {})
    const [item] = getQueue()
    dequeue(item.id)
    expect(queueCount()).toBe(0)
  })
})
