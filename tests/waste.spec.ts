/**
 * Waste log — view, create, filter entries.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'

const TEST_ITEM = uniq('PW Test Bread')

test.describe('Waste log', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/waste')
  })

  test('loads waste log page', async ({ page }) => {
    await expect(page.getByText(/waste/i).first()).toBeVisible()
  })

  test('shows waste entries or empty state', async ({ page }) => {
    const hasEntries = await page.locator('[class*="item"], [class*="card"], li, tr').count()
    const hasEmpty   = await page.getByText(/no waste|empty|none yet|no waste logged/i).count()
    expect(hasEntries + hasEmpty).toBeGreaterThan(0)
  })

  test('can open new waste entry form', async ({ page }) => {
    // Waste form is inline — Item Name input is always visible
    await expect(
      page.getByPlaceholder(/chicken breast|mixed salad/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('can submit a waste entry and it appears in the log', async ({ page }) => {
    // Item name input has no type attribute — target by placeholder
    const nameField = page.getByPlaceholder(/chicken breast|mixed salad/i).first()
    await expect(nameField).toBeVisible({ timeout: 5000 })
    await nameField.fill(TEST_ITEM)

    // Quantity spinbutton
    const qtyField = page.locator('[role="spinbutton"], input[type="number"]').first()
    if (await qtyField.count() > 0) await qtyField.fill('2')

    // Select a reason (required) — click "Expired"
    await page.getByRole('button', { name: /expired/i }).first().click()

    // "Log Waste →" button enables once item name + reason are set
    await page.getByRole('button', { name: /log waste/i }).first().click()

    // The name is unique to this run, so this can only match the row just
    // submitted — the old fixed string matched any of the 26 left behind by
    // previous runs, whether or not this submission worked.
    await expect(page.getByText(TEST_ITEM)).toBeVisible({ timeout: 10000 })
  })
})
