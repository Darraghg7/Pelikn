import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  supabase, supabaseAnonKey,
  setSessionJwt, clearSessionJwt, registerJwtRefresher,
} from '../supabase'

// Build a syntactically-valid JWT with the given exp (seconds since epoch).
function makeJwt(exp, extra = {}) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const header  = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ role: 'authenticated', venue_id: 'v-123', exp, ...extra })
  return `${header}.${payload}.sig`
}
const FUTURE = Math.floor(Date.now() / 1000) + 3600
const PAST   = Math.floor(Date.now() / 1000) - 3600

function authHeaderOf(call) {
  const opts = call[1] || {}
  return new Headers(opts.headers || {}).get('authorization')
}
const okJson = () =>
  new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('venue JWT injection', () => {
  beforeEach(() => {
    clearSessionJwt()
    registerJwtRefresher(null)
    global.fetch = vi.fn(async () => okJson())
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('injects a usable JWT as the bearer on /rest/v1 requests (apikey preserved)', async () => {
    const jwt = makeJwt(FUTURE)
    setSessionJwt(jwt)
    await supabase.from('fridges').select('id')
    const hdr = authHeaderOf(global.fetch.mock.calls[0])
    expect(hdr).toBe(`Bearer ${jwt}`)
    // apikey must still be the anon key
    const apikey = new Headers(global.fetch.mock.calls[0][1].headers).get('apikey')
    expect(apikey).toBe(supabaseAnonKey)
  })

  it('does NOT inject an expired JWT — falls back to the anon key', async () => {
    setSessionJwt(makeJwt(PAST))
    await supabase.from('fridges').select('id')
    const hdr = authHeaderOf(global.fetch.mock.calls[0])
    expect(hdr).toBe(`Bearer ${supabaseAnonKey}`)
  })

  it('refreshes an expired JWT before the request when a refresher is set', async () => {
    const fresh = makeJwt(FUTURE, { refreshed: true })
    const refresher = vi.fn(async () => fresh)
    registerJwtRefresher(refresher)
    setSessionJwt(makeJwt(PAST))
    await supabase.from('fridges').select('id')
    expect(refresher).toHaveBeenCalledTimes(1)
    expect(authHeaderOf(global.fetch.mock.calls[0])).toBe(`Bearer ${fresh}`)
  })

  it('on a 401 it refreshes once and retries with the new token', async () => {
    const fresh = makeJwt(FUTURE, { refreshed: true })
    registerJwtRefresher(vi.fn(async () => fresh))
    setSessionJwt(makeJwt(FUTURE))
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(okJson())
    await supabase.from('fridges').select('id')
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(authHeaderOf(global.fetch.mock.calls[1])).toBe(`Bearer ${fresh}`)
  })

  it('leaves non-data (/auth/v1) requests on the anon/user token', async () => {
    setSessionJwt(makeJwt(FUTURE))
    // hit an auth endpoint via the client
    await supabase.auth.getUser().catch(() => {})
    const authCall = global.fetch.mock.calls.find(c =>
      String(c[0]).includes('/auth/v1/'))
    if (authCall) {
      expect(authHeaderOf(authCall)).not.toBe(`Bearer ${makeJwt(FUTURE)}`)
    }
  })
})
