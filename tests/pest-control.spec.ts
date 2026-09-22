/**
 * Pest control — inspections, sightings, corrective actions.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'

const TEST_LOCATION = uniq('Back door area')

test.describe('Pest control', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/pest-control')
  })

  test('loads pest control page', async ({ page }) => {
    await expect(page.getByText(/pest/i).first()).toBeVisible()
  })

  test('shows inspection history or add button', async ({ page }) => {
    // "Log Entry" tab button is always visible
    await expect(
      page.getByRole('button', { name: /log entry/i }).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can open new pest sighting / inspection form', async ({ page }) => {
    // The log form is shown inline on the "Log Entry" tab (default tab)
    // No modal — just check the form fields are visible
    await expect(
      page.getByPlaceholder(/kitchen store|back yard|near bins/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('can submit a pest sighting', async ({ page }) => {
    // Fill Location field (required)
    await page.getByPlaceholder(/kitchen store|back yard|near bins/i).first().fill(TEST_LOCATION)

    // Fill Description textarea (required)
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 3000 })
    await textarea.fill('PW test sighting — ants near back door')

    // Submit
    await page.getByRole('button', { name: /save|submit|log|record/i }).last().click()

    // Was `not.toContainText('404')`, which passes on any page that renders at
    // all — including one where the submit silently failed.
    //
    // Asserting the sighting text doesn't work either: the form sits on the
    // "log" tab and the saved row only shows under "open"/"history", so it is
    // never rendered back here. The success toast is what the page actually
    // emits on a successful insert, and waiting for it also stops the test
    // ending while the POST is still in flight.
    await expect(page.getByText(/pest control log saved/i)).toBeVisible({ timeout: 10000 })
  })
})
