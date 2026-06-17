import { test as setup } from '@playwright/test'
import fs from 'fs'

const BASE_URL     = 'http://127.0.0.1:5173'
const OWNER_EMAIL  = process.env.TEST_OWNER_EMAIL
const OWNER_PASS   = process.env.TEST_OWNER_PASSWORD
const VENUE_SLUG   = process.env.TEST_VENUE_SLUG     ?? 'brew-and-bloom'
const MANAGER_NAME = process.env.TEST_MANAGER_NAME   ?? 'Sarah Mitchell'
const STAFF_PIN    = process.env.TEST_STAFF_PIN      ?? '1234'

export const OWNER_STATE   = 'tests/auth/owner-state.json'
export const MANAGER_STATE = 'tests/auth/manager-state.json'

/** State files older than this many days are treated as stale and regenerated. */
const MAX_STATE_AGE_DAYS = 7

function isStateStale(filePath: string): boolean {
  try {
    const { mtimeMs } = fs.statSync(filePath)
    const ageDays = (Date.now() - mtimeMs) / (1000 * 60 * 60 * 24)
    return ageDays > MAX_STATE_AGE_DAYS
  } catch {
    return true // file doesn't exist = stale
  }
}

setup('authenticate owner and manager', async ({ page }) => {
  // Skip full re-auth when cached state files exist AND are fresh.
  // Set FORCE_AUTH_SETUP=true to always regenerate.
  const stateFilesExist = fs.existsSync(OWNER_STATE) && fs.existsSync(MANAGER_STATE)
  const stateIsStale    = isStateStale(OWNER_STATE) || isStateStale(MANAGER_STATE)

  if (stateFilesExist && !stateIsStale && !process.env.FORCE_AUTH_SETUP) return

  if (stateIsStale && stateFilesExist) {
    console.log('[global-setup] Auth state is older than 7 days — regenerating…')
    fs.rmSync(OWNER_STATE,   { force: true })
    fs.rmSync(MANAGER_STATE, { force: true })
  }

  if (!OWNER_EMAIL || !OWNER_PASS) {
    throw new Error('Set TEST_OWNER_EMAIL and TEST_OWNER_PASSWORD before running Playwright auth setup.')
  }

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

  // PIN is now a numpad — tap each digit button individually
  for (const digit of STAFF_PIN.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).first().click()
  }
  // Auto-submits on 4th digit; fall back to Sign In button click
  const btn = page.getByRole('button', { name: /sign in/i })
  await Promise.race([
    page.waitForURL(`**/${VENUE_SLUG}/dashboard**`, { timeout: 15000 }),
    btn.click({ timeout: 3000 }).catch(() => {}),
  ])
  await page.waitForURL(`**/${VENUE_SLUG}/dashboard**`, { timeout: 15000 })

  // Save manager state (Supabase auth + PIN session)
  await page.context().storageState({ path: MANAGER_STATE })
})
