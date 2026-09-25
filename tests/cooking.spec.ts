/**
 * Cooking temperatures, hot holding, and cooling logs.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'

const TEST_FOOD = uniq('PW Chicken Test')

test.describe('Cooking temperatures', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/cooking-temps')
  })

  test('loads cooking temps page', async ({ page }) => {
    await expect(page.getByText(/cooking|temp/i).first()).toBeVisible()
  })

  test('shows log form or add button', async ({ page }) => {
    // Page has an inline form with a "Log Reading" tab button and the form below
    await expect(
      page.getByRole('button', { name: /log reading/i }).first()
    ).toBeVisible()
  })

  test('can log a cooking temperature and it appears in the history', async ({ page }) => {
    // Form is already inline — fill food item text and temperature spinbutton
    const textInput = page.locator('input[type="text"], [placeholder*="Chicken"]').first()
    await expect(textInput).toBeVisible({ timeout: 5000 })
    await textInput.fill(TEST_FOOD)

    const tempInput = page.locator('[role="spinbutton"], input[type="number"]').first()
    await expect(tempInput).toBeVisible({ timeout: 5000 })
    await tempInput.fill('75')

    await page.getByRole('button', { name: /save|submit|add|log/i }).last().click()

    // Unique per run, so only this test's own submission can satisfy it.
    await expect(page.getByText(TEST_FOOD)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Hot holding', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/hot-holding')
  })

  test('loads hot holding page', async ({ page }) => {
    await expect(page.getByText(/hot.?holding/i).first()).toBeVisible()
  })

  test('shows AM / PM check sections', async ({ page }) => {
    await expect(page.getByText(/am|pm/i).first()).toBeVisible()
  })

  test('can log a hot holding temperature', async ({ page }) => {
    // Each item due in the current period has its own reading box + Log button.
    // If the first item is already logged this period, reopen it via Edit.
    const input = page.locator('input[inputmode="decimal"]').first()
    if (!(await input.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /^edit$/i }).first().click()
    }
    await expect(input).toBeVisible({ timeout: 5000 })
    await input.fill('65')
    await page.getByRole('button', { name: /^log$/i }).first().click()

    // The page toasts only after the insert succeeds.
    await expect(page.getByText(/65\.0°C logged/i)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Cooling logs', () => {
  test('loads cooling logs page', async ({ page }) => {
    await goto(page, '/cooling-logs')
    await expect(page.getByText(/cooling/i).first()).toBeVisible()
  })

  test('can start a cooling batch and finish it', async ({ page }) => {
    const batch = uniq('PW Cooling Test')
    await goto(page, '/cooling-logs')

    await page.getByLabel(/food item/i).fill(batch)
    await page.getByPlaceholder('75').fill('78')
    await page.getByRole('button', { name: /start cooling timer/i }).click()
    await expect(page.getByText(/cooling timer started/i)).toBeVisible({ timeout: 10000 })

    // The running batch appears under "Cooling now" with its own end-temp box
    const endTemp = page.getByLabel(new RegExp(`${batch} end temperature`, 'i'))
    await expect(endTemp).toBeVisible({ timeout: 10000 })
    await endTemp.fill('5')
    await page.getByRole('button', { name: /^finish$/i }).first().click()

    await expect(page.getByText(/cooled in/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/completed today/i)).toBeVisible({ timeout: 10000 })
  })
})
