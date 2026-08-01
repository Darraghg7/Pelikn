import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { supabase } from '../supabase'
import { onDataWrite } from '../cacheBus'

const ok = (status = 200) =>
  new Response(status === 204 ? null : '[]', {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('write announcements from the supabase fetch wrapper', () => {
  let seen
  let unsubscribe

  beforeEach(() => {
    seen = []
    unsubscribe = onDataWrite((table) => seen.push(table))
    global.fetch = vi.fn(async () => ok())
  })
  afterEach(() => {
    unsubscribe()
    vi.restoreAllMocks()
  })

  it('announces the table on a successful insert', async () => {
    await supabase.from('opening_closing_completions').insert({ check_id: 'c1' })
    expect(seen).toEqual(['opening_closing_completions'])
  })

  it('announces on update, upsert and delete', async () => {
    await supabase.from('corrective_actions').update({ status: 'closed' }).eq('id', 'a1')
    await supabase.from('fridge_temperature_logs').upsert({ fridge_id: 'f1' })
    await supabase.from('cleaning_completions').delete().eq('id', 'x1')
    expect(seen).toEqual([
      'corrective_actions',
      'fridge_temperature_logs',
      'cleaning_completions',
    ])
  })

  it('stays silent on reads — a select must not invalidate anything', async () => {
    await supabase.from('fridges').select('id')
    expect(seen).toEqual([])
  })

  it('stays silent on RPC calls', async () => {
    // Critical: the summary is fetched via a POST to /rest/v1/rpc/…. Announcing
    // that as a write would invalidate the cache that just issued it and
    // refetch forever.
    await supabase.rpc('get_dashboard_snapshot', { p_venue_id: 'v1' })
    expect(seen).toEqual([])
  })

  it('stays silent when the write is rejected', async () => {
    global.fetch = vi.fn(async () => new Response('{}', { status: 403 }))
    await supabase.from('shifts').insert({ shift_date: '2026-01-01' })
    expect(seen).toEqual([])
  })

  it('announces a 204 No Content write', async () => {
    global.fetch = vi.fn(async () => ok(204))
    await supabase.from('duty_item_completions').insert({ duty_assignment_id: 'd1' })
    expect(seen).toEqual(['duty_item_completions'])
  })

  it('a throwing listener does not break the write', async () => {
    const boom = onDataWrite(() => { throw new Error('listener blew up') })
    const res = await supabase.from('time_off_requests').insert({ status: 'pending' })
    boom()
    expect(res.error).toBeNull()
    expect(seen).toEqual(['time_off_requests'])
  })

  it('unsubscribing stops delivery', async () => {
    unsubscribe()
    await supabase.from('cooling_logs').insert({ id: 'l1' })
    expect(seen).toEqual([])
  })
})
