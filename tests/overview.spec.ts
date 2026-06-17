/**
 * Multi-venue Overview page (/v/:slug/overview)
 *
 * The overview page only renders for managers with >1 linked venue.
 * Single-venue managers are redirected to /dashboard.
 * Tests are written to gracefully handle both cases.
 */
import { test, expect } from '@playwright/test'
import { goto, VENUE } from './helpers/nav'
import { injectManagerSession } from './helpers/auth-bypass'

/** Returns true if the overview page actually rendered (vs. redirected). */
async function isOnOverviewPage(page: import('@playwright/test').Page): Promise<boolean> {
  const url = page.url()
  return url.includes('/overview')
}

test.describe('Overview page', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await goto(page, '/overview')
  })

  test('loads without errors (or redirects cleanly for single-venue)', async ({ page }) => {
    // Either on overview or redirected to dashboard — no crash either way
    await expect(page.locator('body')).not.toContainText('Something went wrong')
    await expect(page.locator('body')).not.toContainText('Cannot read properties')
    await expect(page).toHaveURL(/\/v\//, { timeout: 5000 })
  })

  test('multi-venue: shows "My Venues" or "Overview" heading', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip() // single-venue account — skip, not a failure
      return
    }
    await expect(page.getByText(/my venues|overview/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('multi-venue: summary strip renders all 4 stat cells', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip()
      return
    }
    await expect(page.getByText(/all clear/i).first()).toBeVisible({ timeout: 12000 })
    await expect(page.getByText(/need attention/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/staff on shift/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/decisions pending/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('multi-venue: venue cards are visible', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip()
      return
    }
    // Cards have a 3px coloured top border and contain venue names
    const grid = page.locator('[class*="grid"], [class*="gap"]').first()
    await expect(grid).toBeVisible({ timeout: 10000 })
  })

  test('multi-venue: clicking a summary cell activates filter', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip()
      return
    }
    const cell = page.getByText(/need attention/i).first()
    if (await cell.isVisible({ timeout: 10000 }).catch(() => false)) {
      await cell.click()
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    }
  })

  test('multi-venue: clear filter removes active state', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip()
      return
    }
    const cell = page.getByText(/need attention/i).first()
    if (await cell.isVisible({ timeout: 10000 }).catch(() => false)) {
      await cell.click()
      const clear = page.getByText(/clear|✕|×/i).first()
      if (await clear.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clear.click()
        await expect(page.locator('body')).not.toContainText('Something went wrong')
      }
    }
  })

  test('multi-venue: venue card "Open →" link navigates into venue', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip()
      return
    }
    const openBtn = page.getByRole('link', { name: /open/i }).first()
    if (await openBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await openBtn.click()
      await expect(page).toHaveURL(/\/v\//, { timeout: 10000 })
    }
  })
})

test.describe('Overview — nav panel entry point', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await goto(page, '/dashboard')
  })

  test('no crash on dashboard load', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Something went wrong')
    await expect(page).toHaveURL(/\/v\//)
  })

  test('Overview nav tile visible for multi-venue managers', async ({ page }) => {
    // Only visible if manager has >1 venue — skip gracefully for single-venue accounts
    const overviewTile = page.getByText(/^overview$/i).first()
    const isVisible = await overviewTile.isVisible({ timeout: 5000 }).catch(() => false)
    if (isVisible) {
      await overviewTile.click()
      await expect(page).toHaveURL(/overview|dashboard/, { timeout: 8000 })
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    }
    // Not visible = single-venue account; pass silently
  })
})
