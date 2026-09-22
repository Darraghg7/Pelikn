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
import { test, expect } from './helpers/cleanup'
import type { Page } from '@playwright/test'
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

/**
 * A complete clock cycle today: in 08:00, break 12:00–12:30, out 16:00.
 * Worked = 8h gross − 30m break = 7h 30m.
 *
 * Times are built in local time then serialised, so they round-trip back to
 * the same wall-clock hours the components format with getHours().
 */
function clockEventsToday() {
  const at = (h: number, m: number) => {
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }
  return [
    { id: 'ce-in',    event_type: 'clock_in',    occurred_at: at(8, 0) },
    { id: 'ce-bstart', event_type: 'break_start', occurred_at: at(12, 0) },
    { id: 'ce-bend',   event_type: 'break_end',   occurred_at: at(12, 30) },
    { id: 'ce-out',    event_type: 'clock_out',   occurred_at: at(16, 0) },
  ]
}

/**
 * Serve a worked day, with no edit requests and no payroll lock — so the
 * row shows its "Fix" action rather than a status pill or "Locked".
 */
async function mockWorkedDay(page: Page) {
  await page.route('**/rest/v1/clock_events*', route =>
    route.request().method() !== 'GET' ? route.continue() : route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(clockEventsToday()),
    })
  )
  await page.route('**/rest/v1/clock_edit_requests*', route =>
    route.request().method() !== 'GET' ? route.continue() : route.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    })
  )
  // Only the payroll-lock lookup — other app_settings reads pass through.
  await page.route('**/rest/v1/app_settings*', route => {
    const url = route.request().url()
    if (route.request().method() !== 'GET' || !url.includes('payroll_locks')) return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
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

test.describe('Staff rota view — worked hours', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkedDay(page)
    await injectManagerSession(page)
    await goto(page, '/rota?personal=1')
  })

  test('shows the per-day worked card for the selected day', async ({ page }) => {
    await expect(page.getByText(/hours worked/i)).toBeVisible()
    await expect(page.getByText('08:00 — 16:00')).toBeVisible()
    // Untouched sessions are labelled Recorded rather than carrying a request pill.
    await expect(page.getByText('Recorded').first()).toBeVisible()
  })

  test('per-day card shows worked duration net of the break', async ({ page }) => {
    // Anchor on the card before reading its contents. The clock sessions are
    // a secondary fetch that the skeleton wait in goto() does not cover, so
    // asserting the duration directly could start polling before the card
    // existed — this flaked once under full-suite load for exactly that
    // reason, while passing 30/30 in isolation.
    await expect(page.getByText(/hours worked/i)).toBeVisible({ timeout: 15000 })
    // 08:00-16:00 less a 30m break, via ehWorkedMins + ehDurLabel.
    await expect(page.getByText('7h 30m').first()).toBeVisible()
    await expect(page.getByText('30m break').first()).toBeVisible()
  })

  test('shows the weekly worked section with a total', async ({ page }) => {
    await expect(page.getByText(/this week · worked/i)).toBeVisible()
    await expect(page.getByText(/1 logged/i)).toBeVisible()
    await expect(page.getByText('Worked', { exact: true })).toBeVisible()
  })

  test('worked row offers a Fix action when the date is not payroll-locked', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^fix$/i })).toBeVisible()
    await expect(page.getByText('Locked')).toHaveCount(0)
  })

  test('clicking Fix opens the fix-hours sheet', async ({ page }) => {
    await page.getByRole('button', { name: /^fix$/i }).click()
    await expect(page.getByText('Fix hours')).toBeVisible()
    await expect(page.getByText(/on the clock/i)).toBeVisible()
    await expect(page.getByText(/unpaid break/i)).toBeVisible()
    // The recorded break is carried into the sheet, so it offers to remove it.
    await expect(page.getByRole('button', { name: /remove break/i })).toBeVisible()
  })

  test('the sheet asks for a reason only once the hours actually change', async ({ page }) => {
    await page.getByRole('button', { name: /^fix$/i }).click()
    // Nothing edited yet — no reason required.
    await expect(page.getByText(/reason for change/i)).toHaveCount(0)

    // Dropping the 30m break changes worked time, which requires a reason.
    await page.getByRole('button', { name: /remove break/i }).click()
    await expect(page.getByText(/reason for change/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /forgot to clock out/i })).toBeVisible()
  })
})
