/**
 * Incidents — accident, injury and near-miss records.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'

test.describe('Incidents', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/incidents')
  })

  test('loads the incidents page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^incidents$/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^open/i })).toBeVisible()
  })

  test('can report an incident', async ({ page }) => {
    const title = uniq('PW slip by dish wash')
    await page.getByRole('button', { name: /^report$/i }).click()
    await page.getByPlaceholder(/slip on wet floor/i).fill(title)
    await page.getByPlaceholder(/cellar stairs/i).fill('Kitchen')
    await page.getByPlaceholder(/what happened, in order/i).fill('PW test — slipped on wet floor, no injury.')
    await page.getByRole('button', { name: /^report incident$/i }).click()
    await expect(page.getByText(/incident reported/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })

    // Open the record and close it with a note — it moves to the Closed tab
    await page.getByText(title).first().click()
    await page.getByPlaceholder(/what was done/i).fill('PW mat fitted, staff briefed')
    await page.getByRole('button', { name: /^close incident$/i }).click()
    await expect(page.getByText(/incident closed/i)).toBeVisible({ timeout: 10000 })
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: /^closed/i }).click()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })
  })
})
