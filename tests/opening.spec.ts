/**
 * Opening / closing checklists — view, complete items, export.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Opening / closing checklists', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/opening-closing')
  })

  test('loads opening/closing page', async ({ page }) => {
    await expect(page.getByText(/opening|closing/i).first()).toBeVisible()
  })

  test('shows opening section', async ({ page }) => {
    await expect(page.getByText(/opening/i).first()).toBeVisible()
  })

  test('shows closing section', async ({ page }) => {
    await expect(page.getByText(/closing/i).first()).toBeVisible()
  })

  test('shows checklist items', async ({ page }) => {
    // Items use "✓ OK" and "⚠ Issue" buttons, not checkboxes
    await expect(
      page.getByRole('button', { name: /ok|issue/i }).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can tick a checklist item', async ({ page }) => {
    // Click "✓ OK" on first checklist item
    const okBtn = page.getByRole('button', { name: /ok/i }).first()
    if (await okBtn.count() > 0) {
      await okBtn.click()
      await expect(page.locator('body')).not.toContainText('Error')
    }
  })

  test('shows export button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /export|pdf|download/i }).first()
    ).toBeVisible()
  })
})
