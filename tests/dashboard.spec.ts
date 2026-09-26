/**
 * Dashboard — manager dashboard widgets, navigation, staff dashboard.
 */
import { test, expect } from './helpers/cleanup'
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

  // These used nth(1) for a mobile/desktop dual-render that no longer happens:
  // each widget title is now in the DOM exactly once, so nth(1) never resolved
  // and both failed on every run. first() is the visible widget.
  test('shows fridge alerts widget', async ({ page }) => {
    await expect(page.getByText(/^fridges$/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('shows today\'s cleaning tasks widget', async ({ page }) => {
    await expect(page.getByText(/^cleaning$/i).first()).toBeVisible({ timeout: 8000 })
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
