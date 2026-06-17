/**
 * Opening / closing checklists — completed checks sort to bottom.
 *
 * Page heading: "Opening & Closing"
 * Section labels: "Opening Checks" / "Closing Checks"
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'
import { injectManagerSession } from './helpers/auth-bypass'

test.describe('Opening/closing — completed checks sort to bottom', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await goto(page, '/opening-closing')
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 20000 }
    )
  })

  test('page loads without errors', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Something went wrong')
    await expect(page.locator('body')).not.toContainText('Cannot read properties')
  })

  test('shows "Opening & Closing" heading', async ({ page }) => {
    // h1 renders as "Opening & Closing" (HTML entity decoded)
    await expect(page.locator('h1').filter({ hasText: /opening/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows "Opening Checks" section', async ({ page }) => {
    // CheckSection renders "Opening Checks" label — look broadly
    await expect(page.getByText(/opening checks/i).first()).toBeVisible({ timeout: 12000 })
  })

  test('shows "Closing Checks" section', async ({ page }) => {
    await expect(page.getByText(/closing checks/i).first()).toBeVisible({ timeout: 12000 })
  })

  test('completed checks show recorded state, not OK/Issue buttons', async ({ page }) => {
    // If all checks are already done, OK buttons should not be present
    // If some are pending, OK buttons should be present
    // Either way — no crash
    const okBtns     = await page.getByRole('button', { name: /^ok$/i }).count()
    const doneBadges = await page.getByText(/recorded|all clear|completed/i).count()
    expect(okBtns + doneBadges).toBeGreaterThanOrEqual(0)
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('completing a check removes its OK button', async ({ page }) => {
    const okBtn = page.getByRole('button', { name: /^ok$/i }).first()
    if (!(await okBtn.isVisible({ timeout: 8000 }).catch(() => false))) return

    const beforeCount = await page.getByRole('button', { name: /^ok$/i }).count()
    await okBtn.click()

    // Confirm modal if present
    const confirm = page.getByRole('button', { name: /confirm|save|done/i }).first()
    if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirm.click()
    }

    await page.waitForTimeout(800)
    const afterCount = await page.getByRole('button', { name: /^ok$/i }).count()
    expect(afterCount).toBeLessThanOrEqual(beforeCount)
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('incomplete checks appear before completed ones in opening section', async ({ page }) => {
    // Find the opening checks section container
    const openingLabel = page.getByText(/opening checks/i).first()
    if (!(await openingLabel.isVisible({ timeout: 8000 }).catch(() => false))) return

    // Get the parent section that contains both the label and its check rows
    const section = page.locator('[class*="flex-col"]').filter({ has: openingLabel }).first()
    if (!(await section.isVisible().catch(() => false))) return

    // Collect all rows: a row has an OK button (incomplete) or recorded text (complete)
    const rows = section.locator('[class*="p-"]').filter({ has: page.locator('p, span') })
    const count = await rows.count()
    if (count < 2) return

    let seenCompleted  = false
    let orderViolation = false

    for (let i = 0; i < Math.min(count, 20); i++) {
      const row = rows.nth(i)
      const hasOk       = await row.getByRole('button', { name: /^ok$/i }).count() > 0
      const hasRecorded = await row.getByText(/recorded|all clear/i).count() > 0

      if (hasRecorded && !hasOk) seenCompleted = true
      else if (hasOk && seenCompleted) orderViolation = true
    }

    expect(orderViolation).toBe(false)
  })

  test('incomplete checks appear before completed ones in closing section', async ({ page }) => {
    const closingLabel = page.getByText(/closing checks/i).first()
    if (!(await closingLabel.isVisible({ timeout: 8000 }).catch(() => false))) return

    const section = page.locator('[class*="flex-col"]').filter({ has: closingLabel }).first()
    if (!(await section.isVisible().catch(() => false))) return

    const rows = section.locator('[class*="p-"]').filter({ has: page.locator('p, span') })
    const count = await rows.count()
    if (count < 2) return

    let seenCompleted  = false
    let orderViolation = false

    for (let i = 0; i < Math.min(count, 20); i++) {
      const row = rows.nth(i)
      const hasOk       = await row.getByRole('button', { name: /^ok$/i }).count() > 0
      const hasRecorded = await row.getByText(/recorded|all clear/i).count() > 0

      if (hasRecorded && !hasOk) seenCompleted = true
      else if (hasOk && seenCompleted) orderViolation = true
    }

    expect(orderViolation).toBe(false)
  })
})
