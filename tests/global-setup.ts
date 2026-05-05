import { test as setup } from '@playwright/test'

const BASE_URL     = 'http://127.0.0.1:5173'
const OWNER_EMAIL  = process.env.TEST_OWNER_EMAIL    ?? 'demo@safeserv.com'
const OWNER_PASS   = process.env.TEST_OWNER_PASSWORD ?? 'Dearbhala30!'
const VENUE_SLUG   = process.env.TEST_VENUE_SLUG     ?? 'brew-and-bloom'
const MANAGER_NAME = process.env.TEST_MANAGER_NAME   ?? 'Sarah Mitchell'
const STAFF_PIN    = process.env.TEST_STAFF_PIN      ?? '1234'

export const OWNER_STATE   = 'tests/auth/owner-state.json'
export const MANAGER_STATE = 'tests/auth/manager-state.json'

setup('authenticate owner and manager', async ({ page }) => {
  // ── 1. Owner Supabase login ──────────────────────────────────────────
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  // Desktop still starts on a welcome view; the native mobile login form is visible immediately.
  const emailInput = page.locator('input[type="email"]:visible').first()
  if (!(await emailInput.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^sign in$/i }).first().click()
  }
  await emailInput.waitFor({ state: 'visible', timeout: 5000 })
  await emailInput.fill(OWNER_EMAIL)
  await page.locator('input[type="password"]:visible').first().fill(OWNER_PASS)
  await page.locator('button:visible', { hasText: /^Sign In$/ }).last().click()

  // Wait to land on the venue page
  await page.waitForURL(/\/v\//, { timeout: 20000 })

  // Save owner-only state (Supabase auth, no PIN session)
  await page.context().storageState({ path: OWNER_STATE })

  // ── 2. Staff PIN login ───────────────────────────────────────────────
  await page.goto(`${BASE_URL}/v/${VENUE_SLUG}`)
  await page.waitForLoadState('networkidle')

  await page.waitForSelector(`text=${MANAGER_NAME}`, { timeout: 15000 })
  await page.getByText(MANAGER_NAME).first().click()

  await page.waitForSelector('input[type="password"]', { timeout: 5000 })
  await page.locator('input[type="password"]').fill(STAFF_PIN)
  // Auto-submits after 4 digits; fall back to button click for shorter PINs
  const btn = page.getByRole('button', { name: /sign in/i })
  await Promise.race([
    page.waitForURL(`**/${VENUE_SLUG}/dashboard**`, { timeout: 15000 }),
    btn.click({ timeout: 3000 }).catch(() => {}),
  ])
  await page.waitForURL(`**/${VENUE_SLUG}/dashboard**`, { timeout: 15000 })

  // Save manager state (Supabase auth + PIN session)
  await page.context().storageState({ path: MANAGER_STATE })
})
