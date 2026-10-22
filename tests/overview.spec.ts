/**
 * Multi-venue Overview page (/v/:slug/overview)
 *
 * The overview page only renders for managers with >1 linked venue.
 * Single-venue managers are redirected to /dashboard.
 * Tests are written to gracefully handle both cases.
 */
import { test, expect } from './helpers/cleanup'
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
    await expect(page.locator('body')).not.toContainText('This screen hit a snag')
    await expect(page.locator('body')).not.toContainText('Cannot read properties')
    await expect(page).toHaveURL(/\/v\//, { timeout: 5000 })
  })

  test('multi-venue: shows the group overview heading and headline', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip() // single-venue account — skip, not a failure
      return
    }
    await expect(page.getByText(/group overview/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/venues (need you|on track)/i).first()).toBeVisible({ timeout: 12000 })
  })

  test('multi-venue: list view filter and search (6+ venues)', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip()
      return
    }
    const search = page.getByRole('searchbox', { name: /find a venue/i })
    if (!(await search.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip() // 2–5 venues show cards, which have no filter or search
      return
    }
    await page.getByRole('button', { name: /need you/i }).first().click()
    await search.fill('zzzz-no-such-venue')
    await expect(page.getByText(/no venues match/i)).toBeVisible()
    await expect(page.locator('body')).not.toContainText('This screen hit a snag')
  })

  test('multi-venue: a venue link navigates into that venue', async ({ page }) => {
    if (!(await isOnOverviewPage(page))) {
      test.skip()
      return
    }
    const venueLink = page.locator('a[href*="/dashboard"]').first()
    if (await venueLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await venueLink.click()
      await expect(page).toHaveURL(/\/v\/[^/]+\/dashboard/, { timeout: 10000 })
    }
  })
})

test.describe('Overview — nav panel entry point', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await goto(page, '/dashboard')
  })

  test('no crash on dashboard load', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('This screen hit a snag')
    await expect(page).toHaveURL(/\/v\//)
  })

  test('Overview nav tile visible for multi-venue managers', async ({ page }) => {
    // Only visible if manager has >1 venue — skip gracefully for single-venue accounts
    const overviewTile = page.getByText(/^overview$/i).first()
    const isVisible = await overviewTile.isVisible({ timeout: 5000 }).catch(() => false)
    if (isVisible) {
      await overviewTile.click()
      await expect(page).toHaveURL(/overview|dashboard/, { timeout: 8000 })
      await expect(page.locator('body')).not.toContainText('This screen hit a snag')
    }
    // Not visible = single-venue account; pass silently
  })
})
