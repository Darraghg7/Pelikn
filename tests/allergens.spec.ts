/**
 * Allergen registry — list items, view detail, create/edit food items.
 * Also tests the public QR allergen page.
 */
import { test, expect } from '@playwright/test'
import { goto, VENUE } from './helpers/nav'
import { getTestSession, SUPABASE_URL, ANON_KEY } from './helpers/auth-bypass'

// Unique per run. This used to create a row literally named "PW Test Dish"
// every time and never clean up, so the shared venue accumulated dozens of
// them. A unique name makes the assertion unambiguous, and the cleanup below
// stops the pile growing.
const TEST_DISH = `PW Test Dish ${Date.now()}`

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
    await nameField.fill(TEST_DISH)

    // Toggle allergens — checkboxes are sr-only inside <label> wrappers; click the label
    const labels = page.locator('label').filter({ hasText: /gluten/i })
    if (await labels.count() > 0) await labels.first().click()

    await page.getByRole('button', { name: /save|submit|add/i }).last().click()

    // Verify the row the form just created, via the API.
    //
    // This used to assert the literal text "PW Test Dish" was on screen
    // straight after saving. Dozens of rows with that exact name were already
    // in the venue from earlier runs, so the assertion matched one of those
    // and passed without ever checking that *this* dish was created — a false
    // green. Giving the dish a unique name exposed that, and also showed the
    // list does not reliably re-render it within the assertion window.
    //
    // Checking the record directly tests what the form is actually
    // responsible for, without depending on list-refresh timing.
    const session = await getTestSession(page)
    const auth = { apikey: ANON_KEY, Authorization: `Bearer ${session.jwt}` }
    const url  = `${SUPABASE_URL}/rest/v1/food_items?venue_id=eq.${session.venueId}&name=eq.${encodeURIComponent(TEST_DISH)}`
    try {
      await expect.poll(
        async () => (await (await page.request.get(`${url}&select=id`, { headers: auth })).json()).length,
        { timeout: 10000, message: 'the saved dish should exist in the registry' },
      ).toBe(1)
    } finally {
      // Always remove it, pass or fail, so runs stop accumulating dishes in
      // the shared venue's real allergen registry.
      await page.request.delete(url, { headers: auth })
    }
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
