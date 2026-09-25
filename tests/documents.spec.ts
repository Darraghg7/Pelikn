/**
 * Documents — venue licences, insurance and safety records.
 */
import { test, expect } from './helpers/cleanup'
import { goto } from './helpers/nav'

test.describe('Documents', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/documents')
  })

  test('loads the documents page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^documents$/i })).toBeVisible()
    await expect(page.getByLabel(/search documents/i)).toBeVisible()
  })

  test('shows category filters with counts', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^all \d+$/i })).toBeVisible()
    await page.getByRole('button', { name: /^insurance \d+$/i }).click()
    await expect(page.getByRole('button', { name: /^insurance \d+$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens the upload form', async ({ page }) => {
    await page.getByRole('button', { name: /^upload$/i }).click()
    await expect(page.getByText(/choose a file/i)).toBeVisible()
  })
})
