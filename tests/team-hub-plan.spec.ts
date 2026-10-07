/**
 * Team hub tiles on Starter vs Pro, and the Settings profile card.
 *
 * brew-and-bloom is a Pro venue, so the Starter case rewrites the venue row's
 * plan in the network response rather than changing the shared test venue.
 */
import { test, expect } from './helpers/cleanup'
import { goto } from './helpers/nav'
import type { Page } from '@playwright/test'

async function forceStarter(page: Page) {
  await page.route(/\/rest\/v1\/venues\?.*select=id%2Cname%2Cslug%2Cplan/, async route => {
    const res = await route.fetch()
    const body = await res.json()
    const patch = (v: Record<string, unknown>) => ({ ...v, plan: 'starter' })
    await route.fulfill({ response: res, json: Array.isArray(body) ? body.map(patch) : patch(body) })
  })
}

const tile = (page: Page, label: string) =>
  page.locator('button').filter({ has: page.getByText(label, { exact: true }) })

test.describe('Team hub plan badges', () => {
  test('Starter: Pro tiles show a Pro badge and "Upgrade to unlock"', async ({ page }) => {
    await forceStarter(page)
    await goto(page, '/team')
    for (const label of ['Rota', 'My Shifts', 'Hours', 'Training', 'Time Off', 'HR Records', 'My Calendar']) {
      const t = tile(page, label)
      await expect(t).toContainText(/upgrade to unlock/i, { timeout: 10000 })
      await expect(t.getByText('Pro', { exact: true })).toBeVisible()
    }
    // Staff is on every plan.
    await expect(tile(page, 'Staff')).not.toContainText(/upgrade to unlock/i)

    // Tapping still goes to the route, where PlanGate shows the upgrade screen.
    await tile(page, 'HR Records').click()
    await expect(page).toHaveURL(/\/hr$/)
  })

  test('Pro: no badges', async ({ page }) => {
    await goto(page, '/team')
    await expect(tile(page, 'Staff')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/upgrade to unlock/i)).toHaveCount(0)
  })
})

test.describe('Settings profile card', () => {
  test('opens your own Staff page on Starter', async ({ page }) => {
    await forceStarter(page)
    await goto(page, '/settings/hub')
    await page.locator('button.bg-brand').first().click()
    await expect(page).toHaveURL(/\/staff\?staff=[0-9a-f-]+/)
  })
})
