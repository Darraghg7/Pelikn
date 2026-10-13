import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rpcCannotRun } from '../queryErrors'
import { fetchCleaningTasks } from '../api/cleaning'

describe('rpcCannotRun — when the per-table fallback is worth running', () => {
  it('yes: the function is missing or no longer fits the schema', () => {
    expect(rpcCannotRun({ code: 'PGRST202' })).toBe(true) // migration not applied
    expect(rpcCannotRun({ code: '42883' })).toBe(true)    // undefined function
    expect(rpcCannotRun({ code: '42703' })).toBe(true)    // undefined column
    expect(rpcCannotRun({ code: '42P01' })).toBe(true)    // undefined table
  })

  it('no: the database is struggling (13 Oct 2026)', () => {
    expect(rpcCannotRun({ code: '57014' })).toBe(false)   // statement cancelled / timeout
    expect(rpcCannotRun({ code: '53300' })).toBe(false)   // too many connections
    expect(rpcCannotRun({ code: '08006' })).toBe(false)   // connection failure
    expect(rpcCannotRun({ code: 'PGRST301' })).toBe(false)
    expect(rpcCannotRun({ code: '' })).toBe(false)        // gateway 504 / dropped fetch
    expect(rpcCannotRun({})).toBe(false)
    expect(rpcCannotRun(null)).toBe(false)
  })
})

describe('fetchCleaningTasks — a slow database is not "function missing"', () => {
  let urls: string[]
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  beforeEach(() => {
    urls = []
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('throws on a 504 instead of firing the per-table reads', async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      urls.push(typeof url === 'string' ? url : (url as Request).url ?? String(url))
      return new Response('Gateway Timeout', { status: 504 })
    }) as typeof fetch

    await expect(fetchCleaningTasks('venue-1')).rejects.toBeTruthy()
    expect(urls.filter(u => u.includes('/rest/v1/rpc/get_cleaning_state'))).toHaveLength(1)
    expect(urls.filter(u => u.includes('/rest/v1/cleaning_tasks'))).toHaveLength(0)
    expect(urls.filter(u => u.includes('/rest/v1/cleaning_completions'))).toHaveLength(0)
  })

  it('still falls back when the function genuinely isn\'t there', async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : (url as Request).url ?? String(url)
      urls.push(u)
      if (u.includes('/rpc/get_cleaning_state')) {
        return json(404, { code: 'PGRST202', message: 'Could not find the function' })
      }
      return json(200, [])
    }) as typeof fetch

    const res = await fetchCleaningTasks('venue-1')
    expect(res).toEqual({ tasks: [], completions: [] })
    expect(urls.some(u => u.includes('/rest/v1/cleaning_tasks'))).toBe(true)
  })
})
