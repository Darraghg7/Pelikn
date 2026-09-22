/**
 * Daily tasks — view, create, complete, assign.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/tasks')
  })

  test('loads tasks page', async ({ page }) => {
    await expect(page.getByText(/task/i).first()).toBeVisible()
  })

  test('shows task list', async ({ page }) => {
    // Seed data has tasks in Kitchen / Front of House sections
    await expect(
      page.getByText(/kitchen|front of house|recurring/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can open create new task form', async ({ page }) => {
    // Page has "+ One-Off Task" button that reveals an inline form panel
    await page.getByRole('button', { name: /one.off task/i }).first().click()
    // Form is inline — look for the task description textbox
    await expect(
      page.getByPlaceholder(/check delivery|task/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('can create a one-off task', async ({ page }) => {
    await page.getByRole('button', { name: /one.off task/i }).first().click()

    // Fill the task description textbox (placeholder: "e.g. Check delivery from supplier")
    const titleField = page.getByPlaceholder(/check delivery|task/i).first()
    await expect(titleField).toBeVisible({ timeout: 5000 })
    const title = uniq('Playwright test task')
    await titleField.fill(title)

    // Submit with "Assign Task →" button (enables once text is entered)
    await page.getByRole('button', { name: /assign task/i }).first().click()

    // Unique per run. The comment this replaces said .first() was there "to
    // handle duplicate entries from previous runs" — those 37 duplicates were
    // the bug, and matching them is what let this pass without checking its
    // own write.
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })
  })

  test('can mark a task as complete', async ({ page }) => {
    const cb = page.locator('input[type="checkbox"]:not(:checked)').first()
    const btn = page.getByRole('button', { name: /complete|done/i }).first()

    if (await cb.count() > 0) {
      await cb.click()
      await expect(cb).toBeChecked({ timeout: 5000 })
    } else if (await btn.count() > 0) {
      await btn.click()
      await expect(page.locator('body')).not.toContainText('Error')
    }
  })
})
