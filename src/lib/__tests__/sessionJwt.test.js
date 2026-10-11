import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  supabase, supabaseAnonKey,
  setSessionJwt, clearSessionJwt, registerJwtRefresher,
  registerSessionEndedHandler, SessionEndedError,
} from '../supabase'
import { requestVenueJwt, refreshVenueJwt } from '../venueJwt'
import { SESSION_TOKEN_KEY, SESSION_VENUE_ID_KEY, SESSION_JWT_KEY } from '../constants'

// Build a syntactically-valid JWT with the given exp (seconds since epoch).
function makeJwt(exp, extra = {}) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const header  = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ role: 'authenticated', venue_id: 'v-123', exp, ...extra })
  return `${header}.${payload}.sig`
}
const FUTURE = Math.floor(Date.now() / 1000) + 3600
const PAST   = Math.floor(Date.now() / 1000) - 3600

// global.fetch is a vi.fn() in every test here.
const fetchCalls = () => /** @type {import('vitest').Mock} */ (/** @type {unknown} */ (global.fetch)).mock.calls

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
    const hdr = authHeaderOf(fetchCalls()[0])
    expect(hdr).toBe(`Bearer ${jwt}`)
    // apikey must still be the anon key
    const apikey = new Headers(fetchCalls()[0][1].headers).get('apikey')
    expect(apikey).toBe(supabaseAnonKey)
  })

  it('does NOT inject an expired JWT — falls back to the anon key', async () => {
    setSessionJwt(makeJwt(PAST))
    await supabase.from('fridges').select('id')
    const hdr = authHeaderOf(fetchCalls()[0])
    expect(hdr).toBe(`Bearer ${supabaseAnonKey}`)
  })

  it('refreshes an expired JWT before the request when a refresher is set', async () => {
    const fresh = makeJwt(FUTURE, { refreshed: true })
    const refresher = vi.fn(async () => fresh)
    registerJwtRefresher(refresher)
    setSessionJwt(makeJwt(PAST))
    await supabase.from('fridges').select('id')
    expect(refresher).toHaveBeenCalledTimes(1)
    expect(authHeaderOf(fetchCalls()[0])).toBe(`Bearer ${fresh}`)
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
    expect(authHeaderOf(fetchCalls()[1])).toBe(`Bearer ${fresh}`)
  })

  it('leaves non-data (/auth/v1) requests on the anon/user token', async () => {
    setSessionJwt(makeJwt(FUTURE))
    // hit an auth endpoint via the client
    await supabase.auth.getUser().catch(() => { /* only the outgoing request matters here */ })
    const authCall = fetchCalls().find(c =>
      String(c[0]).includes('/auth/v1/'))
    if (authCall) {
      expect(authHeaderOf(authCall)).not.toBe(`Bearer ${makeJwt(FUTURE)}`)
    }
  })
  it('injects the JWT on venue-scoped private buckets (upload + signed URL)', async () => {
    const jwt = makeJwt(FUTURE)
    setSessionJwt(jwt)
    await supabase.storage.from('venue-documents').upload('v-123/a.pdf', new Blob(['x']))
    await supabase.storage.from('hr-documents').createSignedUrl('v-123/s/a.pdf', 60)
    await supabase.storage.from('training-files').upload('v-123/b.pdf', new Blob(['x']))
    const calls = fetchCalls().filter(c => String(c[0]).includes('/storage/v1/'))
    expect(calls).toHaveLength(3)
    for (const c of calls) expect(authHeaderOf(c)).toBe(`Bearer ${jwt}`)
  })

  it('leaves other storage buckets on the anon/user token', async () => {
    const jwt = makeJwt(FUTURE)
    setSessionJwt(jwt)
    await supabase.storage.from('app-assets').upload('logo.png', new Blob(['x']))
    const call = fetchCalls().find(c => String(c[0]).includes('/storage/v1/'))
    expect(authHeaderOf(call)).not.toBe(`Bearer ${jwt}`)
  })
})

// Migration 146: the database refuses a venue JWT whose staff_sessions row is
// gone (revoked / signed out / expired) with a 401. pin-login then refuses to
// re-issue it, and the device must go back to the PIN screen — never retry
// as anon and show empty screens.
describe('session ended (146)', () => {
  const ended401 = () => new Response(
    JSON.stringify({ code: 'PK401', message: 'Session ended' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )

  beforeEach(() => {
    clearSessionJwt()
    registerJwtRefresher(null)
    registerSessionEndedHandler(null)
    global.fetch = vi.fn(async () => okJson())
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('a 401 whose session cannot be re-issued signs out and returns the error, not empty data', async () => {
    const onEnded = vi.fn()
    registerSessionEndedHandler(onEnded)
    registerJwtRefresher(vi.fn(async () => { throw new SessionEndedError('tok-1') }))
    setSessionJwt(makeJwt(FUTURE))
    global.fetch = vi.fn(async () => ended401())

    const { data, error } = await supabase.from('fridges').select('id')

    expect(onEnded).toHaveBeenCalledWith('tok-1')
    expect(global.fetch).toHaveBeenCalledTimes(1)       // no anon retry
    expect(data).toBeNull()
    expect(error?.code).toBe('PK401')
    // The dead JWT is gone: the next request goes out on the anon key.
    global.fetch = vi.fn(async () => okJson())
    await supabase.from('fridges').select('id')
    expect(authHeaderOf(fetchCalls()[0])).toBe(`Bearer ${supabaseAnonKey}`)
  })

  it('an expiring JWT whose session ended is not sent at all', async () => {
    const onEnded = vi.fn()
    registerSessionEndedHandler(onEnded)
    registerJwtRefresher(vi.fn(async () => { throw new SessionEndedError('tok-1') }))
    setSessionJwt(makeJwt(PAST))

    const { error } = await supabase.from('fridges').select('id')

    expect(onEnded).toHaveBeenCalledWith('tok-1')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(error?.code).toBe('PK401')
  })

  it('pin-login unreachable is not a sign-out: falls back as before', async () => {
    const onEnded = vi.fn()
    registerSessionEndedHandler(onEnded)
    registerJwtRefresher(vi.fn(async () => null))
    setSessionJwt(makeJwt(FUTURE))
    global.fetch = vi.fn()
      .mockResolvedValueOnce(ended401())
      .mockResolvedValueOnce(okJson())
    await supabase.from('fridges').select('id')
    expect(onEnded).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('concurrent 401s share one refresh', async () => {
    const fresh = makeJwt(FUTURE, { refreshed: true })
    let release = () => {}
    const refresher = vi.fn(() => new Promise(r => { release = () => r(fresh) }))
    registerJwtRefresher(refresher)
    setSessionJwt(makeJwt(FUTURE))
    let calls = 0
    global.fetch = vi.fn(async () => (++calls <= 3 ? new Response('', { status: 401 }) : okJson()))

    const all = Promise.all([1, 2, 3].map(() => supabase.from('fridges').select('id')))
    await vi.waitFor(() => expect(refresher).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    release()
    await all
    expect(refresher).toHaveBeenCalledTimes(1)
  })
})

describe('venueJwt: pin-login issue_jwt answers', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(SESSION_TOKEN_KEY, 'tok-1')
    localStorage.setItem(SESSION_VENUE_ID_KEY, 'v-123')
  })
  afterEach(() => { vi.restoreAllMocks() })

  const reply = (status, body = {}) => vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

  it('200 → the new JWT, stored for the next app start', async () => {
    global.fetch = reply(200, { jwt: 'new.jwt' })
    expect(await refreshVenueJwt()).toBe('new.jwt')
    expect(localStorage.getItem(SESSION_JWT_KEY)).toBe('new.jwt')
  })

  it.each([401, 403])('%i → the session is gone (SessionEndedError carrying the token)', async (status) => {
    global.fetch = reply(status, { error: 'Invalid or expired session' })
    await expect(refreshVenueJwt()).rejects.toMatchObject({ name: 'SessionEndedError', token: 'tok-1' })
  })

  it.each([500, 503])('%i → try later, not a sign-out', async (status) => {
    global.fetch = reply(status, { error: 'Internal error' })
    expect(await refreshVenueJwt()).toBeNull()
  })

  it('offline → try later, not a sign-out', async () => {
    global.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await requestVenueJwt('tok-1', 'v-123')).toEqual({ jwt: null, ended: false })
  })

  it('no stored session → nothing to ask for', async () => {
    localStorage.clear()
    global.fetch = vi.fn()
    expect(await refreshVenueJwt()).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
