/**
 * Settings — staff CRUD, roles, permissions, venue config.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Settings hub', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/settings')
  })

  test('loads settings page', async ({ page }) => {
    await expect(page.getByText(/settings/i).first()).toBeVisible()
  })

  test('shows navigation tabs / sections', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /venue|roles|shifts|notifications|modules/i }).first()
    ).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Staff management', () => {
  // Staff management is at /staff (separate from /settings)
  test.beforeEach(async ({ page }) => {
    await goto(page, '/staff')
  })

  test('shows staff member list', async ({ page }) => {
    await expect(page.getByText(/sarah|james|tom|lucy/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('can open add staff form', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    // Form expands inline — look for the Name textbox
    await expect(
      page.getByPlaceholder(/full name/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('add staff form has name and PIN fields', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    // Labels are "Name *" and "PIN" as text nodes, not <label for="...">
    // Target by placeholder instead
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder(/••••/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('can create a new staff member', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()

    await page.getByPlaceholder(/full name/i).first().fill('Playwright Tester')
    await page.getByPlaceholder(/••••/i).first().fill('9876')

    await page.getByRole('button', { name: /save|add|create|submit/i }).last().click()

    await expect(page.getByText('Playwright Tester').first()).toBeVisible({ timeout: 8000 })
  })

  test('can edit a staff member', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    if (await editBtn.count() > 0) {
      await editBtn.click()
      await expect(
        page.getByPlaceholder(/full name/i).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('staff form has contracted hours field (PR #14)', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    // Label text: "Contracted Hours / week"
    await expect(
      page.getByText(/contracted hours/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('staff form has working days selector (PR #14)', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    // Label text: "Working Days" with Mon–Sun buttons
    await expect(page.getByText(/working days/i).first()).toBeVisible({ timeout: 5000 })
    // Day-of-week buttons: Mon through Sun (use .first() in case of strict-mode duplicates)
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await expect(page.getByRole('button', { name: day }).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('staff form has employment type dropdown (PR #14)', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    // Label text: "Employment Type" with a <select> containing Full-time / Part-time / Zero-hours
    await expect(page.getByText(/employment type/i).first()).toBeVisible({ timeout: 5000 })
    const select = page.locator('select').filter({ has: page.locator('option', { hasText: /full.?time/i }) })
    await expect(select).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Roles management', () => {
  test('shows roles section', async ({ page }) => {
    await goto(page, '/settings')
    const rolesBtn = page.getByRole('button', { name: /roles.*skills|roles/i }).first()
    if (await rolesBtn.count() > 0) {
      await rolesBtn.click()
      await expect(
        page.getByText(/chef|kitchen|foh|barista/i).first()
      ).toBeVisible({ timeout: 6000 })
    }
  })
})

test.describe('Venue settings', () => {
  test('shows venue config section', async ({ page }) => {
    await goto(page, '/settings')
    await expect(
      page.getByText(/brew.and.bloom|venue name/i).first()
    ).toBeVisible({ timeout: 6000 })
  })
})

test.describe('Permission management', () => {
  test('can view staff permissions', async ({ page }) => {
    await goto(page, '/staff')
    const staffRow = page.getByText(/sarah|james|tom|lucy/i).first()
    if (await staffRow.count() > 0) await staffRow.click()
    await expect(
      page.getByText(/log temps|cleaning|allergen|delivery|permission/i).first()
    ).toBeVisible({ timeout: 6000 })
  })
})
