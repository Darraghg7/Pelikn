/**
 * Corrective actions — list open actions, create, close.
 * Also covers probe calibration and EHO audit.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Corrective actions', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/corrective')
  })

  test('loads corrective actions page', async ({ page }) => {
    await expect(page.getByText(/corrective/i).first()).toBeVisible()
  })

  test('shows open actions list or empty state', async ({ page }) => {
    // Seed data has corrective actions
    await expect(
      page.locator('[class*="item"], [class*="card"], li, h3').first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can open new corrective action form', async ({ page }) => {
    // Button is labeled "+ Log Issue"
    await page.getByRole('button', { name: /log issue/i }).first().click()
    // Opens a Modal with role="dialog"
    await expect(
      page.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('can create a corrective action', async ({ page }) => {
    await page.getByRole('button', { name: /log issue/i }).first().click()
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 })

    // "What happened?" field (required)
    const titleInput = page.locator('[role="dialog"]').locator('input[type="text"]').first()
    await expect(titleInput).toBeVisible({ timeout: 5000 })
    await titleInput.fill('Fridge temperature exceeded safe range')

    // "Action taken" field (required — textarea)
    const actionTextarea = page.locator('[role="dialog"]').locator('textarea').last()
    await expect(actionTextarea).toBeVisible({ timeout: 5000 })
    await actionTextarea.fill('Moved stock to backup fridge, adjusted thermostat')

    // Submit — button enables once both required fields are filled
    await page.locator('[role="dialog"]').getByRole('button', { name: /log corrective/i }).click()
    await expect(page.locator('body')).not.toContainText('404')
  })
})

test.describe('Probe calibration', () => {
  test('loads probe calibration page', async ({ page }) => {
    await goto(page, '/probe')
    await expect(page.getByText(/probe|calibrat/i).first()).toBeVisible()
  })

  test('shows probe list or add button', async ({ page }) => {
    await goto(page, '/probe')
    await expect(
      page.getByRole('button', { name: /add|new|log/i }).first().or(
        page.locator('[class*="probe"], [class*="item"]').first()
      )
    ).toBeVisible({ timeout: 8000 })
  })
})

test.describe('EHO audit', () => {
  test('loads EHO audit page', async ({ page }) => {
    await goto(page, '/audit')
    await expect(page.getByText(/eho|audit/i).first()).toBeVisible()
  })
})

test.describe('Fitness to work', () => {
  test('loads fitness to work page', async ({ page }) => {
    await goto(page, '/fitness')
    await expect(page.getByText(/fitness|fit to work/i).first()).toBeVisible()
  })
})
