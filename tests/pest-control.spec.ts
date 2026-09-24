/**
 * Pest control — inspections, sightings, corrective actions.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'

const TEST_LOCATION = uniq('Back door area')

test.describe('Pest control', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/pest-control')
  })

  test('loads pest control page', async ({ page }) => {
    await expect(page.getByText(/pest/i).first()).toBeVisible()
  })

  test('shows the log entry tab', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /log entry/i })).toBeVisible({ timeout: 8000 })
  })

  test('can save an all-clear routine inspection', async ({ page }) => {
    // Routine inspection + All clear are the defaults — only a location is needed
    await page.getByLabel('Location').fill(TEST_LOCATION)
    await page.getByRole('button', { name: /save entry/i }).click()
    await expect(page.getByText(/pest control log saved/i)).toBeVisible({ timeout: 10000 })
  })

  test('can log a sighting and resolve it with a follow-up', async ({ page }) => {
    const finding = uniq('PW ants near back door')

    await page.getByRole('button', { name: /pest sighting/i }).first().click()
    await page.getByRole('button', { name: /^ant$/i }).click()
    await page.getByLabel('Location').fill(TEST_LOCATION)
    await page.getByLabel(/what did you see/i).fill(finding)
    await page.getByRole('button', { name: /save entry/i }).click()
    await expect(page.getByText(/pest control log saved/i)).toBeVisible({ timeout: 10000 })

    // It's now an open issue; a follow-up links to it and shows in its timeline
    await page.getByRole('tab', { name: /open issues/i }).click()
    const card = page.locator('div', { hasText: finding }).filter({ has: page.getByRole('button', { name: /^resolve$/i }) }).last()
    await card.getByRole('button', { name: /log follow-up/i }).click()
    await page.getByLabel(/what did you find/i).fill('PW bait untouched')
    await page.getByRole('button', { name: /save entry/i }).click()
    await expect(page.getByText(/pest control log saved/i).last()).toBeVisible({ timeout: 10000 })

    // Resolve closes it
    await page.getByRole('tab', { name: /open issues/i }).click()
    await card.getByRole('button', { name: /^resolve$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^resolve$/i }).click()
    await expect(page.getByText(finding)).toHaveCount(0, { timeout: 10000 })
  })
})
