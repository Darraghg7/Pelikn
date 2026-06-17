/**
 * Auth bypass helpers for Playwright tests.
 *
 * Injects a fake staff PIN session into localStorage and intercepts the
 * Supabase RPC that validates the token server-side. This means tests can
 * exercise authenticated pages without a live Supabase account or state files.
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

const FAKE_SESSION = {
  token:      'test-token-playwright-bypass',
  staffId:    '00000000-0000-0000-0000-000000000001',
  staffName:  'Test Manager',
  staffRole:  'manager',
  jobRole:    'kitchen',
  venueId:    '00000000-0000-0000-0000-000000000099',
  venueSlug:  process.env.TEST_VENUE_SLUG ?? 'brew-and-bloom',
}

/**
 * Inject a manager-level PIN session and mock the validation RPC.
 * Call this BEFORE navigating to the page under test.
 */
export async function injectManagerSession(page: Page) {
  // 1. Intercept validate_staff_session — always return valid so the
  //    SessionContext doesn't clear our injected session.
  // validate_staff_session returns a bare boolean: true = valid
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/validate_staff_session`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'true',
    })
  )

  // Also mock refresh_staff_session so it doesn't error
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/refresh_staff_session`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'true',
    })
  )

  // Mock write/completion RPCs so tests can exercise the full UI flow
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/complete_cleaning_task`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/complete_opening_check`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  )

  // Also intercept the Supabase auth endpoint so AuthContext doesn't block.
  await page.route(`${SUPABASE_URL}/auth/v1/token**`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token:  'fake-jwt',
        refresh_token: 'fake-refresh',
        expires_in:    3600,
        token_type:    'bearer',
        user: {
          id:    '00000000-0000-0000-0000-000000000099',
          email: 'test@playwright.local',
          role:  'authenticated',
        },
      }),
    })
  )

  // Also mock the GET session endpoint
  await page.route(`${SUPABASE_URL}/auth/v1/user**`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id:    '00000000-0000-0000-0000-000000000099',
        email: 'test@playwright.local',
        role:  'authenticated',
      }),
    })
  )

  // 2. Inject localStorage keys before the page loads.
  await page.addInitScript((sess) => {
    localStorage.setItem('pelikn_staff_token',    sess.token)
    localStorage.setItem('pelikn_staff_id',       sess.staffId)
    localStorage.setItem('pelikn_staff_name',     sess.staffName)
    localStorage.setItem('pelikn_staff_role',     sess.staffRole)
    localStorage.setItem('pelikn_staff_job_role', sess.jobRole)
    localStorage.setItem('pelikn_venue_id',       sess.venueId)
    localStorage.setItem('pelikn_venue_slug',     sess.venueSlug)
    localStorage.setItem('pelikn_last_venue',     sess.venueSlug)
    localStorage.setItem('pelikn_staff_permissions', '[]')
    // Minimal linked venues so overview/multi-venue tests don't crash
    localStorage.setItem('pelikn_linked_venues', JSON.stringify([
      { id: sess.venueId, slug: sess.venueSlug, name: 'Test Venue' }
    ]))
  }, FAKE_SESSION)
}
