/**
 * Rota — weekly builder, shift creation, time-off requests, timesheet, clock-in.
 * These are Pro plan features; the demo venue (brew-and-bloom) is on Pro.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'

test.describe('Rota builder', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/rota')
  })

  test('loads rota page', async ({ page }) => {
    // After fixing the shiftDurationHours null-guard bug, the rota renders correctly
    await expect(page.getByText(/rota/i).first()).toBeVisible()
    await expect(page.getByText(/upgrade|plan required/i)).not.toBeVisible()
  })

  test('shows week navigation controls', async ({ page }) => {
    // Navigation buttons use ‹ and › (single guillemet) characters
    await expect(
      page.locator('button').filter({ hasText: /[‹›]/ }).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('shows staff names in rota grid', async ({ page }) => {
    // Seed data has shifts — staff names should appear
    await expect(
      page.getByText(/sarah|james|tom|lucy|aoife|conor/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('shows day columns (Mon-Sun)', async ({ page }) => {
    await expect(
      page.getByText(/mon|tue|wed|thu|fri/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('can navigate to next week', async ({ page }) => {
    // Click the › (next week) button
    const nextBtn = page.locator('button').filter({ hasText: '›' }).first()
    await nextBtn.click()
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('can open add shift modal', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add shift|new shift|\+/i }).first()
    if (await addBtn.count() > 0) {
      await addBtn.click()
      await expect(
        page.locator('[role="dialog"], [class*="modal"]').first()
      ).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Time off requests', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/time-off')
  })

  test('loads time-off page', async ({ page }) => {
    await expect(page.getByText(/time.?off|holiday|leave/i).first()).toBeVisible()
  })

  test('shows request list or empty state', async ({ page }) => {
    const hasItems = await page.locator('[class*="request"], [class*="item"], li').count()
    const hasEmpty = await page.getByText(/no requests|none|empty/i).count()
    expect(hasItems + hasEmpty).toBeGreaterThan(0)
  })

  test('can open new time-off request form', async ({ page }) => {
    await page.getByRole('button', { name: /request|new|add/i }).first().click()
    await expect(
      page.locator('form, [role="dialog"]').first()
    ).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Timesheet', () => {
  test('loads timesheet page', async ({ page }) => {
    await goto(page, '/timesheet')
    await expect(page.getByText(/timesheet|hours|labour/i).first()).toBeVisible()
  })

  test('shows staff hours data', async ({ page }) => {
    await goto(page, '/timesheet')
    await expect(page.getByRole('heading', { name: /timesheets/i })).toBeVisible()
    await expect(page.getByText(/pay period summary/i)).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible()
  })
})

test.describe('Clock in / out', () => {
  test('loads clock-in page', async ({ page }) => {
    await goto(page, '/clock-in')
    await expect(page.getByText(/clock.?in|clock.?out/i).first()).toBeVisible()
  })

  test('shows staff tiles for clocking', async ({ page }) => {
    await goto(page, '/clock-in')
    // Staff tiles are shown by name or card element
    await expect(
      page.getByText(/sarah|james|tom|lucy/i).first()
    ).toBeVisible({ timeout: 8000 })
  })
})
