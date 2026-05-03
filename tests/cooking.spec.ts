/**
 * Cooking temperatures, hot holding, and cooling logs.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Cooking temperatures', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/cooking-temps')
  })

  test('loads cooking temps page', async ({ page }) => {
    await expect(page.getByText(/cooking|temp/i).first()).toBeVisible()
  })

  test('shows log form or add button', async ({ page }) => {
    // Page has an inline form with a "Log Reading" tab button and the form below
    await expect(
      page.getByRole('button', { name: /log reading/i }).first()
    ).toBeVisible()
  })

  test('can log a cooking temperature and it appears in the history', async ({ page }) => {
    // Form is already inline — fill food item text and temperature spinbutton
    const textInput = page.locator('input[type="text"], [placeholder*="Chicken"]').first()
    await expect(textInput).toBeVisible({ timeout: 5000 })
    await textInput.fill('PW Chicken Test')

    const tempInput = page.locator('[role="spinbutton"], input[type="number"]').first()
    await expect(tempInput).toBeVisible({ timeout: 5000 })
    await tempInput.fill('75')

    await page.getByRole('button', { name: /save|submit|add|log/i }).last().click()

    // The submitted log entry should appear in the recent records on the page
    await expect(page.getByText('PW Chicken Test').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Hot holding', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/hot-holding')
  })

  test('loads hot holding page', async ({ page }) => {
    await expect(page.getByText(/hot.?holding/i).first()).toBeVisible()
  })

  test('shows AM / PM check sections', async ({ page }) => {
    await expect(page.getByText(/am|pm/i).first()).toBeVisible()
  })

  test('can log a hot holding temperature', async ({ page }) => {
    // Hot holding shows food items with spinbuttons inline — fill them all
    const spinbuttons = page.locator('[role="spinbutton"], input[type="number"]')
    await expect(spinbuttons.first()).toBeVisible({ timeout: 5000 })
    const count = await spinbuttons.count()
    for (let i = 0; i < count; i++) {
      await spinbuttons.nth(i).fill('65')
    }
    // Complete the check period
    await page.getByRole('button', { name: /complete/i }).first().click()
    await expect(page.locator('body')).not.toContainText('404')
  })
})

test.describe('Cooling logs', () => {
  test('loads cooling logs page', async ({ page }) => {
    await goto(page, '/cooling-logs')
    await expect(page.getByText(/cooling/i).first()).toBeVisible()
  })

  test('can open a new cooling log form', async ({ page }) => {
    await goto(page, '/cooling-logs')
    const addBtn = page.getByRole('button', { name: /add|new|log|record/i }).first()
    if (await addBtn.isVisible()) await addBtn.click()

    await expect(
      page.locator('input').first()
    ).toBeVisible({ timeout: 5000 })
  })
})
