import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { supabase } from '../supabase'
import { emitDataWrite } from '../cacheBus'
import { SESSION_ID_KEY } from '../constants'
import {
  takeBootstrap, takeBootstrapSettings, _resetBootstrapForTests,
  BOOTSTRAP_SETTING_KEYS, BOOTSTRAP_TTL_MS,
} from '../api/bootstrap'
import { SETTINGS_KEYS } from '../../hooks/useSettings'

const VENUE = '11111111-1111-1111-1111-111111111111'
const STAFF = '22222222-2222-2222-2222-222222222222'

function bundle(over: Record<string, unknown> = {}) {
  return {
    staff_id: STAFF,
    setting_keys: BOOTSTRAP_SETTING_KEYS,
    settings: [{ key: 'features', value: '{"mode":"all"}' }, { key: 'venue_name', value: 'Cafe' }],
    widget_layout: [], today_items: [], clock_last: [], clock_session: [], week_clock: [],
    closing_shifts: [], my_role_ids: [], my_swaps: [], my_time_off: [], my_shifts_today: [],
    disciplinary: [], unsigned_training: 3, managers: [],
    ...over,
  }
}

let rpc: ReturnType<typeof vi.fn>

beforeEach(() => {
  _resetBootstrapForTests()
  localStorage.setItem(SESSION_ID_KEY, STAFF)
  rpc = vi.fn(async () => ({ data: bundle(), error: null }))
  vi.spyOn(supabase, 'rpc').mockImplementation(rpc as never)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
})

describe('takeBootstrap', () => {
  it('shares one request between every hook that loads at startup', async () => {
    const [a, b, c] = await Promise.all([
      takeBootstrap(VENUE, 'one'),
      takeBootstrap(VENUE, 'two'),
      takeBootstrap(VENUE, 'three', STAFF),
    ])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('get_app_bootstrap')
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_venue_id: VENUE, p_staff_id: STAFF })
    expect(a?.unsigned_training).toBe(3)
    expect(b).toBe(a)
    expect(c).toBe(a)
  })

  it('serves each hook only once — its refetches run the real query', async () => {
    expect(await takeBootstrap(VENUE, 'clockStatus', STAFF)).toBeDefined()
    expect(await takeBootstrap(VENUE, 'clockStatus', STAFF)).toBeUndefined()
  })

  it('is requested at most once per venue per page load', async () => {
    await takeBootstrap(VENUE, 'one')
    await takeBootstrap(VENUE, 'one')
    await takeBootstrap(VENUE, 'late-mounting-hook')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('expires after the TTL', async () => {
    vi.useFakeTimers()
    const first = takeBootstrap(VENUE, 'early')
    await first
    vi.setSystemTime(Date.now() + BOOTSTRAP_TTL_MS + 1)
    expect(await takeBootstrap(VENUE, 'late')).toBeUndefined()
  })

  it('expires as soon as anything is written', async () => {
    await takeBootstrap(VENUE, 'before')
    emitDataWrite('app_settings')
    expect(await takeBootstrap(VENUE, 'after')).toBeUndefined()
  })

  it('is never used for a different staff member', async () => {
    expect(await takeBootstrap(VENUE, 'x', '33333333-3333-3333-3333-333333333333')).toBeUndefined()
  })

  it('is never used for per-person data when nobody is signed in', async () => {
    rpc.mockImplementation(async () => ({ data: bundle({ staff_id: null }), error: null }))
    expect(await takeBootstrap(VENUE, 'personal', null)).toBeUndefined()
    expect(await takeBootstrap(VENUE, 'venue-level')).toBeDefined()
  })

  it('sends no staff id when the stored one is not a real id', async () => {
    localStorage.setItem(SESSION_ID_KEY, 'dev-staff-id')
    await takeBootstrap(VENUE, 'x')
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_staff_id: null })
  })

  it('falls back on an error, and stops asking once the function is known missing', async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { code: 'PGRST202', message: 'not found' } }))
    expect(await takeBootstrap(VENUE, 'a')).toBeUndefined()
    // A different venue would normally get its own bundle — not once it's known missing.
    expect(await takeBootstrap('44444444-4444-4444-4444-444444444444', 'b')).toBeUndefined()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('takeBootstrapSettings', () => {
  it('returns only the rows for the keys asked for', async () => {
    const rows = await takeBootstrapSettings(VENUE, 'features', ['features'])
    expect(rows).toEqual([{ key: 'features', value: '{"mode":"all"}' }])
  })

  it('returns an empty list when a covered key simply has no row', async () => {
    expect(await takeBootstrapSettings(VENUE, 'branding', ['logo_url'])).toEqual([])
  })

  it('falls back when a key was not part of the bundle', async () => {
    expect(await takeBootstrapSettings(VENUE, 'x', ['features', 'some_new_key'])).toBeUndefined()
  })

  it('covers every key useAppSettings reads', () => {
    expect(SETTINGS_KEYS.filter(k => !BOOTSTRAP_SETTING_KEYS.includes(k))).toEqual([])
  })
})
