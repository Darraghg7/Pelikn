/**
 * Staff-facing rota view (/rota?personal=1).
 *
 * This view had no coverage at all: the suite signs in as Sarah Mitchell,
 * who is an owner, so `isManager` is true and the staff view only renders
 * behind `?personal=1` — which nothing visited. That left the whole staff
 * rota, its day-at-a-glance chart and the your-shift card untested.
 *
 * The shift-dependent assertions mock the shifts endpoint rather than
 * relying on rows in the shared test venue. The venue's real shifts sit at
 * fixed dates in the past, so any test that navigated to them would need
 * an ever-growing number of "previous week" clicks as real time moves on.
 * Fixtures are pinned to the current week instead, so this stays stable.
 */
import { test, expect, type Page } from '@playwright/test'
import { format, startOfWeek } from 'date-fns'
import { goto } from './helpers/nav'
import { injectManagerSession, getTestSession } from './helpers/auth-bypass'

const WEEK_START = startOfWeek(new Date(), { weekStartsOn: 1 })
const TODAY      = new Date()

/** Serve a single shift for the signed-in staff member on today. */
async function mockMyShiftToday(page: Page, staffId: string) {
  const shift = {
    id: '00000000-0000-0000-0000-0000000000f1',
    venue_id: null,
    staff_id: staffId,
    week_start: format(WEEK_START, 'yyyy-MM-dd'),
    shift_date: format(TODAY, 'yyyy-MM-dd'),
    start_time: '08:00:00',
    end_time: '16:00:00',
    role_label: 'Kitchen',
    is_closing: false,
    staff: {
      id: staffId,
      name: 'Sarah Mitchell',
      email: null,
      hourly_rate: 12,
      job_role: 'kitchen',
      is_under_18: false,
    },
  }
  await page.route('**/rest/v1/shifts*', route => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([shift]),
    })
  })
}

test.describe('Staff rota view (?personal=1)', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/rota?personal=1')
  })

  test('renders the staff view rather than the manager builder', async ({ page }) => {
    await expect(page.getByText(/my shifts/i).first()).toBeVisible()
    // The manager-only toolbar must not be present in this view.
    await expect(page.getByRole('button', { name: /copy prev week/i })).toHaveCount(0)
  })

  test('shows a seven-day week strip', async ({ page }) => {
    for (const day of ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible()
    }
  })

  test('shows the current week label', async ({ page }) => {
    await expect(page.getByText(/week\s*\d+/i).first()).toBeVisible()
  })

  test('navigating to the previous week changes the week shown', async ({ page }) => {
    const label = page.getByText(/week\s*\d+/i).first()
    const before = await label.innerText()
    // The prev-week control sits immediately before the day strip.
    await page.locator('button.w-8').first().click()
    await expect(async () => {
      expect(await label.innerText()).not.toBe(before)
    }).toPass({ timeout: 8000 })
  })
})

test.describe('Staff rota view — with a shift today', () => {
  test.beforeEach(async ({ page }) => {
    const session = await getTestSession(page)
    await mockMyShiftToday(page, session.staffId)
    await injectManagerSession(page)
    await goto(page, '/rota?personal=1')
  })

  test('renders the day-at-a-glance chart', async ({ page }) => {
    await expect(page.getByText(/day at a glance/i)).toBeVisible()
    await expect(page.getByText(/on shift/i).first()).toBeVisible()
  })

  test('marks the signed-in staff member as YOU in the chart', async ({ page }) => {
    await expect(page.getByText('YOU', { exact: true }).first()).toBeVisible()
  })

  test('shows the your-shift card with times, role and duration', async ({ page }) => {
    await expect(page.getByText(/your shift/i)).toBeVisible()
    await expect(page.getByText(/08:00/).first()).toBeVisible()
    await expect(page.getByText(/16:00/).first()).toBeVisible()
    await expect(page.getByText('Kitchen').first()).toBeVisible()
    // 08:00–16:00 formatted by durationLabel().
    await expect(page.getByText(/\b8h\b/).first()).toBeVisible()
  })
})
