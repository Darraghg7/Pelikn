/**
 * Auth flows — owner login, staff PIN login, permission gates, logout.
 */
import { test, expect } from '@playwright/test'

const VENUE = process.env.TEST_VENUE_SLUG ?? 'brew-and-bloom'

test.describe('Owner login', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows login page at /login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /pelikn/i })).toBeVisible()
    // Form is hidden until "Sign In" is clicked
    await page.getByRole('button', { name: /^sign in$/i }).first().click()
    await expect(page.getByPlaceholder('you@example.com').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /^sign in$/i }).first().click()
    await page.waitForSelector('input[type="email"]', { timeout: 5000 })
    await page.locator('input[type="email"]').first().fill('wrong@example.com')
    await page.locator('input[type="password"]').first().fill('wrongpassword')
    await page.getByRole('button', { name: /^sign in$/i }).last().click()
    await expect(page.getByText(/invalid|incorrect|error/i).first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Staff PIN login', () => {
  // Use owner-only auth (Supabase session, no PIN session) so we see the tiles
  test.use({ storageState: 'tests/auth/owner-state.json' })

  test('shows staff tiles at venue login page', async ({ page }) => {
    await page.goto(`/v/${VENUE}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Sarah Mitchell')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("James O'Brien")).toBeVisible()
  })

  test('shows PIN pad after selecting a staff member', async ({ page }) => {
    await page.goto(`/v/${VENUE}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Sarah Mitchell').click()
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('shows error on wrong PIN', async ({ page }) => {
    await page.goto(`/v/${VENUE}`)
    await page.waitForSelector('text=Sarah Mitchell', { timeout: 15000 })
    await page.getByText('Sarah Mitchell').first().click()
    await page.waitForSelector('input[type="password"]', { timeout: 5000 })
    await page.locator('input[type="password"]').fill('9999')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 8000 })
  })

  test('successful PIN login redirects to dashboard', async ({ page }) => {
    await page.goto(`/v/${VENUE}`)
    await page.waitForSelector('text=Sarah Mitchell', { timeout: 15000 })
    await page.getByText('Sarah Mitchell').first().click()
    await page.waitForSelector('input[type="password"]', { timeout: 5000 })
    await page.locator('input[type="password"]').fill('1234')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL(`**/v/${VENUE}/dashboard**`, { timeout: 15000 })
    await expect(page).toHaveURL(new RegExp(`/v/${VENUE}/dashboard`))
  })
})

test.describe('404 page', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows 404 for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist-at-all')
    await expect(page.getByText(/404|not found/i).first()).toBeVisible()
  })
})
