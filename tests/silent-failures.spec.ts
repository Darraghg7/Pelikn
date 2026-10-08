/**
 * A failed save must say so. Each test forces one write to fail at the network
 * layer (so nothing reaches the real test venue) and checks the user sees an
 * error toast — and no success message.
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import { goto } from './helpers/nav'
import { SUPABASE_URL } from './helpers/auth-bypass'

const failAppSettingsWrites = async (page: Page) => {
  await page.route(`${SUPABASE_URL}/rest/v1/app_settings**`, (route: Route) => {
    if (route.request().method() === 'GET') return route.continue()
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'XX000', message: 'simulated failure' }),
    })
  })
}

test('switching on an optional extra that fails to save shows an error', async ({ page }) => {
  await failAppSettingsWrites(page)
  await goto(page, '/settings/hub-tiles')
  const row = page.locator('div.flex.items-center.gap-3', { has: page.getByText('Recall & Withdrawal', { exact: true }) })
  await row.locator('button[aria-pressed]').click()
  await expect(page.getByText("Couldn't save that change", { exact: false })).toBeVisible()
  await page.screenshot({ path: 'test-results/silent-failures-extras.png' })
})

test('venue details that fail to save show an error, not "Saved"', async ({ page }) => {
  await failAppSettingsWrites(page)
  await goto(page, '/settings/venue')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText("Couldn't save venue details", { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /Saved/ })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/silent-failures-venue.png' })
})
