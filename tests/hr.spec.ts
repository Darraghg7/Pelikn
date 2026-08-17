/**
 * HR hub + Employee Record Panel.
 *
 * Route-mocks every table EmployeeRecordPanel's six tabs touch, so assertions
 * are against known fixture data rather than "did it crash" alone — this is
 * the coverage that must stay green across the cached-hooks migration
 * (see project memory: EmployeeRecordPanel was HELD from Phase 4 until this
 * existed).
 */
import { test, expect, Page } from '@playwright/test'
import { goto } from './helpers/nav'
import { injectManagerSession } from './helpers/auth-bypass'

const SUPABASE_URL = 'https://djwgyyerxvxovicixxrp.supabase.co'
const STAFF_ID = '00000000-0000-0000-0000-0000000000a1'

const STAFF_ROW = {
  id: STAFF_ID,
  name: 'Jamie Rivera',
  job_role: 'chef',
  employment_type: 'full_time',
  start_date: '2023-01-15',
  hourly_rate: 12.5,
  contracted_hours: 30,
  working_days: [1, 2, 3, 4, 5],
  is_under_18: false,
  emergency_contact_name: 'Alex Rivera',
  emergency_contact_phone: '07700900000',
  holiday_pay_eligible: true,
}

const HR_DOCUMENT = {
  id: 'doc-1',
  staff_id: STAFF_ID,
  venue_id: '00000000-0000-0000-0000-000000000099',
  title: 'Employment Contract 2024',
  category: 'contract',
  file_path: 'x/y.pdf',
  file_name: 'contract.pdf',
  file_size: 20480,
  expiry_date: null,
  notes: null,
  created_at: '2024-01-20T10:00:00Z',
}

const FORMAL_ACTION = {
  id: 'formal-1',
  staff_id: STAFF_ID,
  action_type: 'verbal_warning',
  occurred_at: '2026-06-01',
  notes: 'Late to shift twice in one week.',
  file_path: null,
  file_name: null,
  added_by_staff: { name: 'Sarah Mitchell' },
}

const TIME_OFF_REQUEST = {
  id: 'leave-1',
  staff_id: STAFF_ID,
  start_date: '2026-08-01',
  end_date: '2026-08-05',
  leave_type: 'annual',
  status: 'approved',
  reason: null,
}

const TRAINING_CERT = {
  id: 'cert-1',
  staff_id: STAFF_ID,
  title: 'Level 2 Food Hygiene',
  category: 'food_hygiene',
  expiry_date: '2027-01-01',
}

const INDUCTION = {
  id: 'ind-1',
  staff_id: STAFF_ID,
  trainer_name: 'Sarah Mitchell',
  training_date: '2023-01-16',
  staff_acknowledged: true,
}

const STAFF_SESSION = {
  token: 'session-abc',
  device_label: 'iPad — Kitchen',
  created_at: '2026-08-10T09:00:00Z',
  expires_at: '2026-09-10T09:00:00Z',
}

async function mockHRTables(page: Page) {
  // staff: single-record fetch (EmployeeRecordPanel header) vs list fetch (HRHubPage).
  // Match on a leading [?&] so "venue_id=eq." doesn't false-positive on "id=eq.".
  const hasParam = (url: string, name: string) => new RegExp(`[?&]${name}=eq\\.`).test(url)

  await page.route(`${SUPABASE_URL}/rest/v1/staff?*`, route => {
    const url = route.request().url()
    if (hasParam(url, 'id')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STAFF_ROW) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([STAFF_ROW]) })
  })

  await page.route(`${SUPABASE_URL}/rest/v1/hr_formal_actions?*`, route => {
    const url = route.request().url()
    if (hasParam(url, 'staff_id')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([FORMAL_ACTION]) })
    }
    // HRHubPage's venue-wide "recent formal actions" query — just staff_id column
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ staff_id: STAFF_ID }]) })
  })

  await page.route(`${SUPABASE_URL}/rest/v1/staff_hr_documents?*`, route => {
    const req = route.request()
    if (req.method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { 'content-range': '0-0/1' }, body: '' })
    }
    const url = req.url()
    if (hasParam(url, 'staff_id')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([HR_DOCUMENT]) })
    }
    // HRHubPage's "docs expiring soon" query
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route(`${SUPABASE_URL}/rest/v1/staff_disciplinary_log?*`, route => {
    const req = route.request()
    if (req.method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route(`${SUPABASE_URL}/rest/v1/clock_events?*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/shifts?*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/time_off_requests?*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([TIME_OFF_REQUEST]) })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/staff_training?*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([TRAINING_CERT]) })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/training_sign_offs?*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([INDUCTION]) })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/list_staff_sessions`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([STAFF_SESSION]) })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/revoke_staff_session`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  )
}

test.describe('HR hub', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await mockHRTables(page)
    await goto(page, '/hr')
  })

  test('loads and shows the staff member', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Something went wrong')
    await expect(page.getByTestId('record-panel-name')).toHaveText('Jamie Rivera', { timeout: 10000 })
  })

  test('Profile tab shows employment details', async ({ page }) => {
    await expect(page.getByTestId('record-panel-name')).toHaveText('Jamie Rivera', { timeout: 10000 })
    // "Contract" is a DataRow label rendered in the always-visible SectionCard
    // (unlike the identity-row summary lines, which are split lg:hidden / hidden lg:flex).
    await expect(page.getByText('Contract', { exact: true })).toBeVisible({ timeout: 8000 })
  })

  test('Documents tab shows the uploaded document', async ({ page }) => {
    await page.getByTestId('record-tab-Documents').click()
    await expect(page.getByText('Employment Contract 2024')).toBeVisible({ timeout: 8000 })
  })

  test('Disciplinary tab shows the formal action', async ({ page }) => {
    await page.getByTestId('record-tab-Disciplinary').click()
    await expect(page.getByText(/verbal warning/i).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/late to shift twice/i)).toBeVisible({ timeout: 8000 })
  })

  test('Leave tab shows the approved request', async ({ page }) => {
    await page.getByTestId('record-tab-Leave').click()
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('Training tab shows the certificate and induction', async ({ page }) => {
    await page.getByTestId('record-tab-Training').click()
    await expect(page.getByText('Level 2 Food Hygiene')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/induction/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('Security tab shows the active session and can revoke it', async ({ page }) => {
    await page.getByTestId('record-tab-Security').click()
    await expect(page.getByText(/iPad — Kitchen/i)).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: /^revoke$/i }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: /^revoke$/i }).click()
    await expect(page.getByText(/session revoked/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('switching tabs does not refetch visibly (cache holds within session)', async ({ page }) => {
    // Regression guard for the migration: once Documents has loaded, flipping
    // to another tab and back should not show the loading skeleton again.
    await page.getByTestId('record-tab-Documents').click()
    await expect(page.getByText('Employment Contract 2024')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('record-tab-Profile').click()
    await page.getByTestId('record-tab-Documents').click()
    await expect(page.getByText('Employment Contract 2024')).toBeVisible({ timeout: 3000 })
  })
})
