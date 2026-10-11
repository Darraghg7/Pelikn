import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { clearSessionJwt, registerJwtRefresher, registerSessionEndedHandler } from '../../lib/supabase'
import {
  SESSION_TOKEN_KEY, SESSION_ID_KEY, SESSION_JWT_KEY, SESSION_VENUE_ID_KEY,
} from '../../lib/constants'
import { SessionProvider, useSession } from '../SessionContext'
import { VenueProvider, useVenue } from '../VenueContext'

// What broke Nomad on 8 Oct 2026: a device whose PIN session had ended opened
// the app. The venue read went out with the dead venue JWT and was refused,
// pin-login confirmed the session was gone, and the device was signed out —
// correctly. But VenueContext then retried the read WITHOUT the plan column
// and filled in 'starter', so the Pro venue showed as Starter (Pro screens
// locked) until the app was reopened. These run the real Supabase client,
// pin-login answer handling, SessionProvider and VenueProvider against a fake
// network.

const VENUE = { id: '00000000-0000-0000-0000-000000000001', name: 'Nomad', slug: 'nomad-bakes', plan: 'pro' }

function makeJwt(exp) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64({ role: 'authenticated', venue_id: VENUE.id, session_token: 'tok-dead', exp })}.sig`
}
const now = () => Math.floor(Date.now() / 1000)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** The network with 146 applied and the device's session gone. */
function deadSessionNetwork(jwt) {
  return vi.fn(async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input.url)
    const auth = new Headers(init.headers || {}).get('authorization')
    if (url.includes('/functions/v1/pin-login')) return json({ error: 'Session expired' }, 401)
    if (url.includes('/rpc/validate_staff_session')) return json(false)
    if (url.includes('/rest/v1/venues')) {
      if (auth === `Bearer ${jwt}`) return json({ code: 'PK401', message: 'Session ended' }, 401)
      const select = new URL(url).searchParams.get('select') ?? ''
      const row = { id: VENUE.id, name: VENUE.name, slug: VENUE.slug }
      return json(select.includes('plan') ? { ...row, plan: VENUE.plan } : row)
    }
    return json([])
  })
}

function Probe() {
  const { venuePlan } = useVenue()
  const { session, loading } = useSession()
  return <p>plan:{venuePlan} session:{loading ? 'loading' : session ? 'yes' : 'none'}</p>
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={[`/v/${VENUE.slug}`]}>
      <Routes>
        <Route path="/v/:venueSlug/*" element={<SessionProvider><VenueProvider><Probe /></VenueProvider></SessionProvider>} />
      </Routes>
    </MemoryRouter>,
  )
}

// global.fetch is a vi.fn() in every test here.
const fetchCalls = () => /** @type {import('vitest').Mock} */ (/** @type {unknown} */ (global.fetch)).mock.calls
const venueReads = () => fetchCalls().filter(([u]) => String(u).includes('/rest/v1/venues'))

const cachedPlan = () => JSON.parse(localStorage.getItem(`pelikn_venue_${VENUE.slug}`) ?? '{}').plan

describe('a device whose session ended opens the app (Nomad, 8 Oct 2026)', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionJwt()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(SESSION_TOKEN_KEY, 'tok-dead')
    localStorage.setItem(SESSION_ID_KEY, 'staff-1')
    localStorage.setItem(SESSION_VENUE_ID_KEY, VENUE.id)
  })
  afterEach(() => {
    registerJwtRefresher(null)
    registerSessionEndedHandler(null)
    clearSessionJwt()
    vi.restoreAllMocks()
  })

  it.each([
    ['the database refuses the JWT (146, PK401)', () => makeJwt(now() + 3600)],
    ['the JWT has expired and pin-login will not renew it', () => makeJwt(now() - 60)],
  ])('%s: back to the PIN screen, and the venue stays Pro', async (_, jwtFor) => {
    const jwt = jwtFor()
    localStorage.setItem(SESSION_JWT_KEY, jwt)
    localStorage.setItem(`pelikn_venue_${VENUE.slug}`, JSON.stringify(VENUE))
    global.fetch = deadSessionNetwork(jwt)

    renderApp()

    await waitFor(() => expect(screen.getByText(/session:none/)).toBeInTheDocument())
    // The read that settles it: the retry, sent without the dead JWT.
    await waitFor(() => {
      const anonVenueReads = venueReads().filter(([, init]) =>
        new Headers(init?.headers).get('authorization') !== `Bearer ${jwt}`)
      expect(anonVenueReads.length).toBeGreaterThanOrEqual(1)
    })
    await waitFor(() => expect(screen.getByText(/plan:pro/)).toBeInTheDocument())
    expect(cachedPlan()).toBe('pro')
    // Every venue read asked for the plan: none of them could make one up.
    for (const [u] of venueReads()) {
      expect(new URL(String(u)).searchParams.get('select')).toContain('plan')
    }
  })

  it('with nothing cached it still loads the real plan instead of a lookup error', async () => {
    const jwt = makeJwt(now() + 3600)
    localStorage.setItem(SESSION_JWT_KEY, jwt)
    global.fetch = deadSessionNetwork(jwt)

    renderApp()

    await waitFor(() => expect(screen.getByText(/plan:pro session:none/)).toBeInTheDocument())
    expect(cachedPlan()).toBe('pro')
  })

  it('a venue read that fails twice keeps the cached plan', async () => {
    localStorage.setItem(`pelikn_venue_${VENUE.slug}`, JSON.stringify(VENUE))
    localStorage.removeItem(SESSION_TOKEN_KEY)
    global.fetch = vi.fn(async (input) => (
      String(input).includes('/rest/v1/venues') ? json({ message: 'upstream timeout' }, 503) : json([])
    ))

    renderApp()

    await waitFor(() => expect(venueReads()).toHaveLength(2))
    expect(screen.getByText(/plan:pro/)).toBeInTheDocument()
    expect(cachedPlan()).toBe('pro')
  })
})
