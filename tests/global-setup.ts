import { test as setup } from '@playwright/test'

const BASE_URL     = 'http://localhost:5173'
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

  // Landing page starts in 'welcome' view — click Sign In to reveal form
  await page.getByRole('button', { name: /^sign in$/i }).first().click()
  await page.waitForSelector('input[type="email"]', { timeout: 5000 })
  await page.locator('input[type="email"]').first().fill(OWNER_EMAIL)
  await page.locator('input[type="password"]').first().fill(OWNER_PASS)
  await page.getByRole('button', { name: /^sign in$/i }).last().click()

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
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL(`**/${VENUE_SLUG}/dashboard**`, { timeout: 15000 })

  // Save manager state (Supabase auth + PIN session)
  await page.context().storageState({ path: MANAGER_STATE })
})
