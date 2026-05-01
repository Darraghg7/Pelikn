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
    await expect(page.getByText(/fridge/i).first()).toBeVisible()
  })

  test('shows today\'s cleaning tasks widget', async ({ page }) => {
    await expect(page.getByText(/cleaning/i).first()).toBeVisible()
  })

  test('nav links are accessible', async ({ page }) => {
    // Sidebar/nav should have key links
    const navLinks = ['Fridge', 'Cleaning', 'Allergens']
    for (const link of navLinks) {
      await expect(page.getByRole('link', { name: new RegExp(link, 'i') }).first()).toBeVisible()
    }
  })

  test('can navigate to fridge from dashboard', async ({ page }) => {
    // Click the "X fridges not logged today" action link in the Today card
    await page.getByText(/fridges not logged today/i).click()
    await page.waitForURL(`**/v/${VENUE}/fridge**`, { timeout: 15000 })
    await expect(page).toHaveURL(new RegExp(`/v/${VENUE}/fridge`))
  })
})
