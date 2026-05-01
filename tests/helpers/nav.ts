/**
 * Shared navigation helpers and constants for all specs.
 */
import { Page, expect } from '@playwright/test'

export const VENUE = process.env.TEST_VENUE_SLUG ?? 'brew-and-bloom'
export const BASE  = `/v/${VENUE}`

/**
 * Navigate to a venue-scoped path and wait for the app to be fully ready.
 * SPAs make Supabase calls AFTER networkidle fires, so we also wait for the
 * FullPageLoader spinner to disappear before returning.
 */
export async function goto(page: Page, path: string) {
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
