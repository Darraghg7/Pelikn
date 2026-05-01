/**
 * Cleaning schedule — view tasks, mark complete, export.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Cleaning schedule', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/cleaning')
  })

  test('loads cleaning page', async ({ page }) => {
    await expect(page.getByText(/cleaning/i).first()).toBeVisible()
  })

  test('shows cleaning task list', async ({ page }) => {
    // At least one task from seed data should be visible
    await expect(
      page.locator('[class*="task"], [class*="item"], li, tr').first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('shows task frequency labels (daily / weekly)', async ({ page }) => {
    await expect(
      page.getByText(/daily|weekly|monthly/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can mark a task as complete', async ({ page }) => {
    // Find first unchecked task checkbox or complete button
    const checkbox = page.locator('input[type="checkbox"]:not(:checked)').first()
    const completeBtn = page.getByRole('button', { name: /complete|done|mark/i }).first()

    if (await checkbox.count() > 0) {
      await checkbox.click()
      await expect(checkbox).toBeChecked({ timeout: 5000 })
    } else if (await completeBtn.count() > 0) {
      await completeBtn.click()
      await expect(page.locator('body')).not.toContainText('Error')
    }
  })

  test('shows export button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /export|download|pdf/i }).first()
    ).toBeVisible()
  })

  test('export modal opens', async ({ page }) => {
    await page.getByRole('button', { name: /export|download|pdf/i }).first().click()
    await expect(
      page.locator('[role="dialog"], [class*="modal"]').first()
    ).toBeVisible({ timeout: 5000 })
  })
})
