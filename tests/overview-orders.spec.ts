/**
 * Multi-venue overview dashboard and supplier orders — previously untested routes.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Overview dashboard', () => {
  test('loads the overview page', async ({ page }) => {
    await goto(page, '/overview')
    await expect(page.getByRole('heading', { name: /my venues/i })).toBeVisible({ timeout: 10000 })
  })

  test('shows compliance or venue summary content', async ({ page }) => {
    await goto(page, '/overview')
    await expect(page.getByRole('link', { name: /brew & bloom/i }).first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Supplier orders', () => {
  test('loads the supplier orders page', async ({ page }) => {
    await goto(page, '/orders')
    await expect(page.getByText(/order|supplier/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows orders list or empty state', async ({ page }) => {
    await goto(page, '/orders')
    await expect(
      page.locator('[class*="item"], [class*="card"], li, tr, [role="row"]')
        .first()
        .or(page.getByText(/no order|empty|none yet/i).first())
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows button to create a new order', async ({ page }) => {
    await goto(page, '/orders')
    await expect(
      page.getByRole('button', { name: /new order|add order|place order/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })
})
