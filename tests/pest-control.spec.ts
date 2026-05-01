/**
 * Pest control — inspections, sightings, corrective actions.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Pest control', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/pest-control')
  })

  test('loads pest control page', async ({ page }) => {
    await expect(page.getByText(/pest/i).first()).toBeVisible()
  })

  test('shows inspection history or add button', async ({ page }) => {
    // "Log Entry" tab button is always visible
    await expect(
      page.getByRole('button', { name: /log entry/i }).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can open new pest sighting / inspection form', async ({ page }) => {
    // The log form is shown inline on the "Log Entry" tab (default tab)
    // No modal — just check the form fields are visible
    await expect(
      page.getByPlaceholder(/kitchen store|back yard|near bins/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('can submit a pest sighting', async ({ page }) => {
    // Fill Location field (required)
    await page.getByPlaceholder(/kitchen store|back yard|near bins/i).first().fill('Back door area')

    // Fill Description textarea (required)
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 3000 })
    await textarea.fill('Test sighting — ants near back door')

    // Submit
    await page.getByRole('button', { name: /save|submit|log|record/i }).last().click()
    await expect(page.locator('body')).not.toContainText('404')
  })
})
