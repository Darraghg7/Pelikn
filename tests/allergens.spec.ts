/**
 * Allergen registry — list items, view detail, create/edit food items.
 * Also tests the public QR allergen page.
 */
import { test, expect } from '@playwright/test'
import { goto, VENUE } from './helpers/nav'

test.describe('Allergen registry', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/allergens')
  })

  test('loads allergen registry', async ({ page }) => {
    await expect(page.getByText(/allergen/i).first()).toBeVisible()
  })

  test('shows food item list', async ({ page }) => {
    // Seed data includes food items
    await expect(
      page.locator('[class*="item"], [class*="card"], li').first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('shows EU allergen labels', async ({ page }) => {
    await expect(
      page.getByText(/gluten|milk|eggs|nuts/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can open new food item form', async ({ page }) => {
    // "Add Dish" is rendered as a <Link> (role=link), not a button
    await page.getByRole('link', { name: /add dish/i }).first().click()
    await expect(
      page.getByRole('heading', { name: /add new dish/i })
    ).toBeVisible({ timeout: 5000 })
  })

  test('can create a food item with allergens', async ({ page }) => {
    await page.getByRole('link', { name: /add dish/i }).first().click()

    // Name input has no type attribute — use placeholder to target it
    const nameField = page.getByPlaceholder(/caesar salad/i).first()
    await expect(nameField).toBeVisible({ timeout: 5000 })
    await nameField.fill('PW Test Dish')

    // Toggle allergens — checkboxes are sr-only inside <label> wrappers; click the label
    const labels = page.locator('label').filter({ hasText: /gluten/i })
    if (await labels.count() > 0) await labels.first().click()

    await page.getByRole('button', { name: /save|submit|add/i }).last().click()

    await expect(page.getByText('PW Test Dish').first()).toBeVisible({ timeout: 8000 })
  })

  test('can view food item detail', async ({ page }) => {
    // Click View link on first food item
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    await viewLink.click()
    await expect(
      page.getByRole('heading').first()
    ).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Public allergen page (QR code)', () => {
  test('is accessible without auth', async ({ page }) => {
    await page.goto(`/allergens/${VENUE}`)
    try {
      await page.waitForLoadState('networkidle', { timeout: 8000 })
    } catch { /* realtime connections prevent networkidle */ }
    await expect(page.getByText(/allergen/i).first()).toBeVisible({ timeout: 8000 })
    await expect(page).not.toHaveURL(/login/)
  })
})
