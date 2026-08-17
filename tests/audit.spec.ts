/**
 * EHO Audit page — regression coverage for a bug found in review: resolving a
 * failed reading used to remove it from the underlying cached array entirely,
 * which silently shrank "Total readings" / caTotal / totalCerts (all derived
 * as array.length) even though the reading still happened — it just stopped
 * failing. Fixed by patching is_resolved/status in place instead of deleting
 * the row. This test locks that in.
 */
import { test, expect, Page } from '@playwright/test'
import { goto } from './helpers/nav'
import { injectManagerSession } from './helpers/auth-bypass'

const SUPABASE_URL = 'https://djwgyyerxvxovicixxrp.supabase.co'

const FRIDGE = { id: 'fridge-1', name: 'Walk-in', min_temp: 0, max_temp: 5 }

// 4 readings: 2 pass, 2 fail (one of which we'll resolve).
const TEMP_LOGS = [
  { id: 't1', temperature: 3, logged_at: '2026-08-15T08:00:00Z', exceedance_reason: null, logged_by_name: 'A', is_resolved: false, fridge: FRIDGE },
  { id: 't2', temperature: 2, logged_at: '2026-08-15T18:00:00Z', exceedance_reason: null, logged_by_name: 'A', is_resolved: false, fridge: FRIDGE },
  { id: 't3', temperature: 9, logged_at: '2026-08-16T08:00:00Z', exceedance_reason: null, logged_by_name: 'A', is_resolved: false, fridge: FRIDGE },
  { id: 't4', temperature: 11, logged_at: '2026-08-16T18:00:00Z', exceedance_reason: null, logged_by_name: 'A', is_resolved: false, fridge: FRIDGE },
]

async function mockAuditTables(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/fridge_temperature_logs?*`, route => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TEMP_LOGS) })
  })
  for (const table of ['cleaning_tasks', 'cleaning_completions', 'delivery_checks', 'probe_calibrations', 'corrective_actions', 'staff_training']) {
    await page.route(`${SUPABASE_URL}/rest/v1/${table}?*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
  }
  await page.route(`${SUPABASE_URL}/rest/v1/staff?*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
}

test.describe('EHO Audit — resolving a reading does not shrink the total', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await mockAuditTables(page)
    await goto(page, '/audit')
  })

  test('Total readings stays at 4 after resolving a failed one', async ({ page }) => {
    await expect(page.getByText('Total readings')).toBeVisible({ timeout: 10000 })
    // Open the Temperature Monitoring drill-down (2 failed of 4 total).
    const failedToggle = page.getByRole('button', { name: /2 failed reading/i })
    await expect(failedToggle).toBeVisible({ timeout: 8000 })
    await failedToggle.click()

    const resolveBtn = page.getByRole('button', { name: /resolved/i }).first()
    await expect(resolveBtn).toBeVisible({ timeout: 8000 })
    await resolveBtn.click()

    await expect(page.getByText(/marked as resolved/i)).toBeVisible({ timeout: 8000 })

    // The bug: Total readings would drop from 4 to 3 here because the
    // resolved row was deleted from the cache instead of patched in place.
    const totalRow = page.locator('text=Total readings').locator('..')
    await expect(totalRow.getByText('4', { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
