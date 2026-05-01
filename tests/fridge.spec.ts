/**
 * Fridge temperature logging — dashboard, log form, history.
 */
import { test, expect } from '@playwright/test'
import { goto, VENUE } from './helpers/nav'

test.describe('Fridge dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/fridge')
  })

  test('loads fridge dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /temperature logs/i })).toBeVisible()
  })

  test('shows AM / PM period buttons or status', async ({ page }) => {
    await expect(page.getByText(/am|pm/i).first()).toBeVisible()
  })

  test('shows today\'s check status for fridges', async ({ page }) => {
    // Seed data creates: Bar Fridge, Main Display Fridge, Prep Fridge
    await expect(page.getByText(/bar fridge/i).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/prep fridge/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('shows export PDF button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /export pdf/i })).toBeVisible()
  })
})

test.describe('Fridge log form', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/fridge/log')
  })

  test('loads the temperature log form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /log temperature/i })).toBeVisible()
    await expect(page.locator('form')).toBeVisible()
  })

  test('shows fridge selector', async ({ page }) => {
    // Fridge selector uses clickable buttons, not a <select>
    await expect(page.getByText(/bar fridge|prep fridge|main display/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('shows NumPad after selecting a fridge', async ({ page }) => {
    // Select first fridge button
    await page.getByText(/bar fridge/i).first().click()
    // NumPad should appear with digit buttons — use exact regex to avoid matching fridge names
    await expect(page.getByRole('button', { name: /^5$/ }).first()).toBeVisible()
  })

  test('submits a valid temperature log', async ({ page }) => {
    // Select a fridge
    await page.getByText(/bar fridge/i).first().click()
    // Enter temperature 3°C via NumPad — exact regex prevents matching fridge selector buttons
    await page.getByRole('button', { name: /^3$/ }).first().click()
    // Submit
    await page.getByRole('button', { name: /save reading/i }).click()
    // Should redirect back to fridge dashboard
    await page.waitForURL(`**/v/${VENUE}/fridge`, { timeout: 12000 })
    await expect(page).toHaveURL(new RegExp(`/v/${VENUE}/fridge`))
  })

  test('shows out-of-range warning for high temperature', async ({ page }) => {
    // Select Prep Fridge (safe range 0–5°C)
    await page.getByText(/prep fridge/i).first().click()
    // Enter 1 then 0 = 10°C via NumPad (exact regex avoids matching fridge selector buttons)
    await page.getByRole('button', { name: /^1$/ }).first().click()
    await page.getByRole('button', { name: /^0$/ }).first().click()
    // Should show out-of-range warning with reason picker
    await expect(page.getByText(/safe range|reason/i).first()).toBeVisible({ timeout: 6000 })
  })
})

test.describe('Fridge history', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/fridge/history')
  })

  test('loads the history page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /temperature history/i })).toBeVisible()
  })

  test('shows fridge filter selector', async ({ page }) => {
    await expect(page.locator('select').first()).toBeVisible()
  })

  test('shows temperature log entries from seed data', async ({ page }) => {
    // Use 30 Days to include seed data and any readings logged during this test run
    await page.getByRole('button', { name: /30 days/i }).click()
    // Any table row is sufficient — just verify data loaded (not 0 entries)
    // Use tbody td to avoid matching hidden <option> elements in the fridge filter dropdown
    await expect(
      page.locator('tbody tr').first()
    ).toBeVisible({ timeout: 15000 })
  })
})
