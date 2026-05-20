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
    // Items may be incomplete (showing OK/Issue buttons) or already completed (showing recorded text)
    const hasButtons  = await page.getByRole('button', { name: /ok|issue/i }).first().count() > 0
    const hasRecorded = await page.getByText(/recorded|all clear/i).first().count() > 0
    expect(hasButtons || hasRecorded).toBe(true)
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
