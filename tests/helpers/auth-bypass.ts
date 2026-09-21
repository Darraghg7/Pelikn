/**
 * Auth bypass helpers for Playwright tests.
 *
 * Performs a REAL PIN login against the dedicated test venue (brew-and-bloom,
 * manager "Sarah Mitchell") via the pin-login edge function, then injects the
 * resulting real, signed session into localStorage before navigation.
 *
 * This used to inject a fake string token instead. That worked fine before
 * migration 091 (venue-scoped RLS) went live, because the anon key alone
 * could still read real data. Once 091 shipped, PostgREST started rejecting
 * the fake token outright as a malformed JWT, so the client fell back to the
 * plain anon key — which RLS now scopes to zero rows for every venue table.
 * Pages had nothing to render and every data-dependent assertion timed out.
 * A real login is the only way to get a validly-signed venue JWT, since the
 * signing secret lives server-side and can't be faked from the client.
 *
 * The login result is cached for the lifetime of the test process
 * (playwright.config.ts runs workers: 1, so this is once per run) rather
 * than repeated per test, to avoid piling up staff_sessions rows against the
 * real venue.
 *
 * Usage:
 *   import { injectManagerSession } from './helpers/auth-bypass'
 *
 *   test.beforeEach(async ({ page }) => {
 *     await injectManagerSession(page)
 *     await goto(page, '/cleaning')
 *   })
 */

import { Page } from '@playwright/test'

const SUPABASE_URL = 'https://djwgyyerxvxovicixxrp.supabase.co'
// Public anon key — safe to embed; identical to the client-side fallback in src/lib/supabase.js.
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2d5eWVyeHZ4b3ZpY2l4eHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDIyMzEsImV4cCI6MjA4ODkxODIzMX0.PD3MydxFkVladSc7Trje7R3kPikE3axfqnIEkEM08Q8'

const VENUE_SLUG   = process.env.TEST_VENUE_SLUG   ?? 'brew-and-bloom'
const MANAGER_NAME = process.env.TEST_MANAGER_NAME ?? 'Sarah Mitchell'
const STAFF_PIN    = process.env.TEST_STAFF_PIN    ?? '1234'

interface RealSession {
  token:        string
  staffId:      string
  staffName:    string
  staffRole:    string
  jobRole:      string | null
  venueId:      string
  venueSlug:    string
  permissions:  string[]
  linkedVenues: Array<{ id: string; slug: string; name: string }>
  jwt:          string
}

let cached: Promise<RealSession> | null = null

async function realLogin(page: Page): Promise<RealSession> {
  const restHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }

  const venueRes = await page.request.get(
    `${SUPABASE_URL}/rest/v1/venues?slug=eq.${VENUE_SLUG}&select=id`,
    { headers: restHeaders }
  )
  const [venue] = await venueRes.json()
  if (!venue?.id) throw new Error(`[auth-bypass] Test venue "${VENUE_SLUG}" not found`)

  const staffRes = await page.request.get(
    `${SUPABASE_URL}/rest/v1/staff?venue_id=eq.${venue.id}&name=eq.${encodeURIComponent(MANAGER_NAME)}&select=id`,
    { headers: restHeaders }
  )
  const [staff] = await staffRes.json()
  if (!staff?.id) throw new Error(`[auth-bypass] Test manager "${MANAGER_NAME}" not found in venue "${VENUE_SLUG}"`)

  const loginRes = await page.request.post(`${SUPABASE_URL}/functions/v1/pin-login`, {
    headers: { ...restHeaders, 'Content-Type': 'application/json' },
    data: { action: 'login', staff_id: staff.id, pin: STAFF_PIN, venue_id: venue.id },
  })
  if (!loginRes.ok()) {
    throw new Error(`[auth-bypass] Real PIN login failed (${loginRes.status()}): ${await loginRes.text()}`)
  }
  const body = await loginRes.json()

  return {
    token:        body.session_token,
    staffId:      staff.id,
    staffName:    body.staff?.name ?? MANAGER_NAME,
    staffRole:    body.staff?.role ?? 'manager',
    jobRole:      body.staff?.job_role ?? null,
    venueId:      venue.id,
    venueSlug:    VENUE_SLUG,
    permissions:  body.permissions ?? [],
    linkedVenues: body.linked_venues ?? [{ id: venue.id, slug: VENUE_SLUG, name: VENUE_SLUG }],
    jwt:          body.jwt,
  }
}

/**
 * Log in as the real test manager in the dedicated test venue, and inject
 * the resulting real session into localStorage. Call this BEFORE navigating
 * to the page under test.
 */
export async function injectManagerSession(page: Page) {
  if (!cached) cached = realLogin(page)
  const session = await cached

  // Mock write/completion RPCs so tests can exercise the full UI flow
  // without leaving completion records behind in the real venue.
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/complete_cleaning_task`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/complete_opening_check`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  )

  await page.addInitScript((sess) => {
    localStorage.setItem('pelikn_staff_token',       sess.token)
    localStorage.setItem('pelikn_staff_id',          sess.staffId)
    localStorage.setItem('pelikn_staff_name',        sess.staffName)
    localStorage.setItem('pelikn_staff_role',        sess.staffRole)
    localStorage.setItem('pelikn_staff_job_role',    sess.jobRole ?? '')
    localStorage.setItem('pelikn_venue_id',          sess.venueId)
    localStorage.setItem('pelikn_venue_slug',        sess.venueSlug)
    localStorage.setItem('pelikn_last_venue',        sess.venueSlug)
    localStorage.setItem('pelikn_staff_jwt',         sess.jwt)
    localStorage.setItem('pelikn_staff_permissions', JSON.stringify(sess.permissions))
    localStorage.setItem('pelikn_linked_venues',     JSON.stringify(sess.linkedVenues))
  }, session)
}
