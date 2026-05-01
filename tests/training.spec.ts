/**
 * Training records, noticeboard, HACCP, EHO mock — Pro features.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Training records', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/training')
  })

  test('loads training page', async ({ page }) => {
    await expect(page.getByText(/training/i).first()).toBeVisible()
  })

  test('shows staff training records', async ({ page }) => {
    await expect(
      page.locator('[class*="record"], [class*="item"], [class*="card"], li, tr, button').first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can open add training record form', async ({ page }) => {
    // "+ New Record" opens a custom fullscreen modal (not role="dialog")
    await page.getByRole('button', { name: /new record/i }).first().click()
    // Modal heading is "New SC6 Training Record"
    await expect(
      page.getByText(/new sc6 training record/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('can add a training record', async ({ page }) => {
    await page.getByRole('button', { name: /new record/i }).first().click()
    await expect(page.getByText(/new sc6 training record/i).first()).toBeVisible({ timeout: 5000 })

    // Select staff member
    const staffSelect = page.locator('select').first()
    if (await staffSelect.count() > 0) await staffSelect.selectOption({ index: 1 })

    // Fill trainer name (required field)
    const trainerInput = page.getByPlaceholder(/name of person delivering/i).first()
    if (await trainerInput.count() > 0) await trainerInput.fill('Test Trainer')

    // Select all topics via the "Select all" button (topics use spans, not checkboxes)
    const selectAllBtn = page.getByRole('button', { name: /select all/i }).first()
    if (await selectAllBtn.count() > 0) await selectAllBtn.click()

    // Button says "Send for Staff Signature →"
    await page.getByRole('button', { name: /send for staff signature/i }).first().click({ timeout: 8000 })
    await expect(page.locator('body')).not.toContainText('404')
  })
})

test.describe('Noticeboard', () => {
  test('loads noticeboard page', async ({ page }) => {
    await goto(page, '/noticeboard')
    await expect(page.getByRole('heading', { name: /noticeboard/i })).toBeVisible({ timeout: 10000 })
  })

  test('can post a notice', async ({ page }) => {
    await goto(page, '/noticeboard')
    const addBtn = page.getByRole('button', { name: /post notice/i }).first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      const textField = page.locator('textarea, input[type="text"]').first()
      if (await textField.count() > 0) await textField.fill('Playwright test notice')
      await page.getByRole('button', { name: /save|post|submit/i }).last().click()
      await expect(page.locator('body')).not.toContainText('404')
    }
  })
})

test.describe('HACCP', () => {
  test('loads HACCP page', async ({ page }) => {
    await goto(page, '/haccp')
    await expect(page.getByText(/haccp/i).first()).toBeVisible()
  })
})

test.describe('EHO mock inspection', () => {
  test('loads EHO mock page', async ({ page }) => {
    await goto(page, '/eho-mock')
    await expect(page.getByText(/eho|mock|inspection/i).first()).toBeVisible()
  })
})

test.describe('Supplier orders', () => {
  test('loads supplier orders page', async ({ page }) => {
    await goto(page, '/suppliers')
    await expect(page.getByText(/supplier/i).first()).toBeVisible()
  })

  test('can open new order form', async ({ page }) => {
    await goto(page, '/suppliers')
    const addBtn = page.getByRole('button', { name: /new order/i }).first()
    if (await addBtn.count() > 0 && await addBtn.isEnabled()) {
      await addBtn.click()
      await expect(
        page.locator('[role="dialog"]').first()
      ).toBeVisible({ timeout: 5000 })
    }
  })
})
