/**
 * Shared navigation helpers and constants for all specs.
 */
import { Page, expect } from '@playwright/test'
import { injectManagerSession } from './auth-bypass'

export const VENUE = process.env.TEST_VENUE_SLUG ?? 'brew-and-bloom'
export const BASE  = `/v/${VENUE}`

/**
 * Navigate to a venue-scoped path and wait for the app to be fully ready.
 * SPAs make Supabase calls AFTER networkidle fires, so we also wait for the
 * FullPageLoader spinner to disappear before returning.
 *
 * Ensures a real manager session is injected first — most specs don't call
 * injectManagerSession() themselves, and a venue-scoped route with no
 * session at all can't render authenticated content regardless of what the
 * auth-bypass helper does internally. Cheap to call redundantly for the
 * specs that already inject their own session (see auth-bypass.ts caching).
 */
export async function goto(page: Page, path: string) {
  await injectManagerSession(page)
  await page.goto(`${BASE}${path}`)
  // networkidle can hang forever on pages with WebSocket/realtime subscriptions.
  // Use a short timeout so we don't block; the spinner wait below is the real gate.
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 })
  } catch {
    // Some pages use Supabase realtime connections that prevent networkidle
  }
  // Wait up to 20 s for any full-page loading spinner to clear.
  // FullPageLoader uses .animate-spin and is the only element with that class
  // while auth/venue/session context is resolving.
  try {
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 20000 }
    )
  } catch {
    // Spinner didn't clear — test will fail on its own assertion
  }

  // Then wait for per-section skeletons to clear. The full-page spinner only
  // covers auth/venue/session resolving; individual panels keep fetching
  // after it goes, so a test asserting on content could race the data in and
  // fail intermittently under load. `.animate-pulse` is used consistently
  // across the app for skeletons and "Loading…"/"Saving…" placeholders, so
  // its absence is a good "data has landed" signal.
  //
  // Shorter cap than the spinner: this is a best-effort settle, and some
  // screens legitimately render no skeleton at all.
  try {
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 8000 }
    )
  } catch {
    // Still loading — the test's own assertion will decide the outcome
  }
}

/** Assert the page heading matches the given text (case-insensitive). */
export async function expectHeading(page: Page, text: string | RegExp) {
  await expect(page.getByRole('heading', { name: text })).toBeVisible()
}

/** Wait for a toast/success message to appear. */
export async function expectSuccess(page: Page) {
  await expect(
    page.locator('[class*="toast"], [class*="success"], [role="alert"]').first()
  ).toBeVisible({ timeout: 8000 })
}

/** Fill a numeric input that may be a plain <input> or a custom NumPad. */
export async function fillTemp(page: Page, label: string | RegExp, value: string) {
  const field = page.getByLabel(label)
  await field.fill(value)
}
