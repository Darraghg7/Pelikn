/**
 * Dashboard — manager dashboard widgets, navigation, staff dashboard.
 */
import { test, expect } from '@playwright/test'
import { goto, VENUE } from './helpers/nav'

test.describe('Manager dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/dashboard')
  })

  test('loads without errors', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/)
    // Some heading or nav element visible
    await expect(page.locator('body')).not.toContainText('Error')
  })

  test('shows compliance score widget', async ({ page }) => {
    await expect(page.getByText(/compliance/i).first()).toBeVisible()
  })

  test('shows fridge alerts widget', async ({ page }) => {
    // Both mobile (lg:hidden) and desktop (hidden lg:block) render Fridge Status.
    // Mobile is nth(0) and hidden at desktop viewport; desktop is nth(1) and visible.
    await expect(page.getByText(/fridge status/i).nth(1)).toBeVisible({ timeout: 8000 })
  })

  test('shows today\'s cleaning tasks widget', async ({ page }) => {
    // Same dual-render pattern — cleaning widget nth(1) is the visible desktop version.
    await expect(page.getByText(/^cleaning$/i).nth(1)).toBeVisible({ timeout: 8000 })
  })

  test('nav links are accessible', async ({ page }) => {
    // "Customise" button is in the desktop-only greeting header (hidden lg:flex)
    await expect(page.getByRole('button', { name: /customise/i })).toBeVisible({ timeout: 8000 })
  })

  test('can navigate to fridge from dashboard', async ({ page }) => {
    // The sidebar "Compliance" section is collapsed by default.
    // Expand it so the Fridge Temps nav link becomes interactable.
    const complianceToggle = page.getByRole('button', { name: /compliance/i }).first()
    if (await complianceToggle.count() > 0) {
      await complianceToggle.click()
    }
    await page.getByRole('link', { name: /fridge/i }).first().click()
    await page.waitForURL(/\/fridge/, { timeout: 15000 })
    await expect(page).toHaveURL(/\/fridge/)
  })
})
