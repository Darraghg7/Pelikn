/**
 * Optional extras (Settings → Features → Optional extras).
 *
 * The venue's 'features' setting is served from an in-memory copy, and saves
 * land in that copy instead of the database, so the shared test venue's real
 * switches are never changed. Covers: menus, hub tiles, the Extras list, the
 * redirect for a switched-off page, and switching one on in Settings.
 *
 * SHOTS=<dir> also saves screenshots there (used for the PR).
 */
import { test, expect } from './helpers/cleanup'
import type { Page } from '@playwright/test'
import { goto } from './helpers/nav'
import { injectManagerSession } from './helpers/auth-bypass'
import { mockFeatures } from './helpers/features'

const SHOTS = process.env.SHOTS

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

async function asStaff(page: Page) {
  await injectManagerSession(page)
  await page.addInitScript(() => localStorage.setItem('pelikn_staff_role', 'staff'))
}

const rail = (page: Page) => page.locator('aside, nav').first()

// Route handlers may still be mid-fetch when a test ends.
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }) })

test.describe('Optional extras — desktop manager', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('switched off: gone from the menu, and the page sends you to the dashboard', async ({ page }) => {
    await mockFeatures(page, { mode: 'all', extras: [] })
    await goto(page, '/fridge')
    await page.getByText('Compliance', { exact: true }).first().click()
    await expect(page.getByText('Fridge Temps').first()).toBeVisible()
    for (const label of ['Recall & Withdrawal', 'Complaints', 'Mock Inspection', 'Date Labels', 'Equipment']) {
      await expect(page.getByText(label, { exact: true }), label).toHaveCount(0)
    }
    await shot(page, 'desktop-rail-extras-off')

    // Plain goto: the note only shows for a few seconds, and the helper's
    // network-idle wait can outlast it.
    await page.goto('/v/brew-and-bloom/recall')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText(/Recall & Withdrawal is turned off\. Turn it on in Settings → Features\./)).toBeVisible()
    await shot(page, 'desktop-redirect-toast')
  })

  test('switching an extra on in Settings shows it in the menu and opens the page', async ({ page }) => {
    const mock = await mockFeatures(page, { mode: 'all', extras: [] })
    await goto(page, '/settings/hub-tiles')
    const row = page.locator('div').filter({ has: page.getByText('Recall & Withdrawal', { exact: true }) }).filter({ has: page.locator('button[aria-pressed]') }).last()
    await expect(row.locator('button[aria-pressed]')).toHaveAttribute('aria-pressed', 'false')
    await row.locator('button[aria-pressed]').click()
    await expect(row.locator('button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(mock.extras).toEqual(['recall'])
    await shot(page, 'desktop-settings-extras')

    await goto(page, '/recall')
    await expect(page).toHaveURL(/\/recall$/)
    await page.getByText('Compliance', { exact: true }).first().click()
    await expect(page.getByText('Recall & Withdrawal', { exact: true }).first()).toBeVisible()
    await shot(page, 'desktop-rail-recall-on')
  })
})

test.describe('Optional extras — phone manager', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('Checks hub: no Fitness tile or Extras list when off', async ({ page }) => {
    await mockFeatures(page, { mode: 'all', extras: [] })
    await goto(page, '/checks')
    await expect(page.getByText('Fridge Temps').first()).toBeVisible()
    await expect(page.getByText('Fitness to Work', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Extras', { exact: true })).toHaveCount(0)
    await shot(page, 'phone-checks-extras-off')

    // The note wraps to fit a phone instead of running off the screen.
    await page.goto('/v/brew-and-bloom/complaints')
    const note = page.getByText(/Complaints is turned off/)
    await expect(note).toBeVisible()
    const box = await note.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(375)
    await shot(page, 'phone-redirect-toast')
  })

  test('Checks + Team hubs: switched-on extras appear and open', async ({ page }) => {
    await mockFeatures(page, { mode: 'all', extras: ['fitness', 'recall', 'waste', 'tips'] })
    await goto(page, '/checks')
    // (No Fitness tile assertion: the test venue hid that tile by hand via Edit.)
    await expect(page.getByText('Extras', { exact: true })).toBeVisible()
    await expect(page.getByText('Recall & Withdrawal', { exact: true })).toBeVisible()
    await expect(page.getByText('Waste', { exact: true })).toBeVisible()
    await expect(page.getByText('Complaints', { exact: true })).toHaveCount(0)
    await page.getByText('Extras', { exact: true }).scrollIntoViewIfNeeded()
    await shot(page, 'phone-checks-extras-on')
    await page.getByText('Recall & Withdrawal', { exact: true }).click()
    await expect(page).toHaveURL(/\/recall$/)

    await goto(page, '/team')
    await expect(page.getByText('Tips', { exact: true })).toBeVisible()
    await expect(page.getByText('Noticeboard', { exact: true })).toHaveCount(0)
    await page.getByText('Extras', { exact: true }).scrollIntoViewIfNeeded()
    await shot(page, 'phone-team-extras-on')

    await goto(page, '/fitness')
    await expect(page).toHaveURL(/\/fitness$/)
  })

  test('Settings → Features at phone width', async ({ page }) => {
    await mockFeatures(page, { mode: 'all', extras: ['fitness'] })
    await goto(page, '/settings/hub-tiles')
    await expect(page.getByText('Optional extras', { exact: true })).toBeVisible()
    await shot(page, 'phone-settings-extras')
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(375)
  })
})

test.describe('Optional extras — staff', () => {
  test('a switched-off page tells staff to ask their manager', async ({ page }) => {
    await mockFeatures(page, { mode: 'all', extras: [] })
    await asStaff(page)
    await page.goto('/v/brew-and-bloom/noticeboard')
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
    await expect(page.getByText(/Noticeboard is turned off for this venue\. Ask your manager/)).toBeVisible()
    await shot(page, 'staff-redirect-toast')
  })

  test('noticeboard shows in the staff menu only when on', async ({ page }) => {
    await mockFeatures(page, { mode: 'all', extras: ['noticeboard'] })
    await asStaff(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/v/brew-and-bloom/noticeboard')
    await expect(page).toHaveURL(/\/noticeboard$/, { timeout: 15000 })
    await expect(rail(page)).toBeVisible()
  })
})
