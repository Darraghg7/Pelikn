/**
 * Departments — people are ticked into departments, and managers switch
 * Cleaning / Tasks / Opening & Closing between departments.
 *
 * The test venue has no departments of its own, so this adds one through
 * Settings and removes it again afterwards (deleting a department only
 * un-assigns things — nothing else is lost).
 */
import { test, expect } from './helpers/cleanup'
import { goto } from './helpers/nav'
import { getTestSession, SUPABASE_URL, ANON_KEY } from './helpers/auth-bypass'

const DEPT = `E2E Dept ${Date.now()}`
const SHOTS = process.env.DEPT_SHOTS_DIR

test.describe.serial('Departments', () => {
  // Created outside any test so the per-test cleanup fixture doesn't reclaim
  // it between steps; afterAll removes it.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    const s = await getTestSession(page)
    const res = await page.request.post(`${SUPABASE_URL}/rest/v1/departments`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${s.jwt}`, 'Content-Type': 'application/json' },
      data: { venue_id: s.venueId, name: DEPT, sort_order: 99 },
    })
    expect(res.ok()).toBe(true)
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    const s = await getTestSession(page)
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/departments?venue_id=eq.${s.venueId}&name=like.E2E%20Dept*`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${s.jwt}` } },
    )
    await page.close()
  })

  test('Settings has no permission titles any more', async ({ page }) => {
    await goto(page, '/settings/staff?tab=roles')
    await expect(page.getByText('Job titles', { exact: true })).toBeVisible()
    await expect(page.getByText(/permission titles?/i)).toHaveCount(0)
  })

  test('closing sign-off lives in Compliance, with its state shown on Opening & Closing', async ({ page }) => {
    await goto(page, '/settings/compliance')
    await expect(page.getByText('Closers sign off before clocking out')).toBeVisible()
    await goto(page, '/settings/attendance')
    await expect(page.getByText(/sign-off to clock out|Closers sign off/)).toHaveCount(0)
    await goto(page, '/opening-closing')
    await page.getByRole('link', { name: 'Change' }).click()
    await expect(page).toHaveURL(/settings\/compliance/)
  })

  test('departments in Settings appear as ticks on the staff page', async ({ page }) => {
    await goto(page, '/settings/staff?tab=roles')
    await expect(page.getByText(DEPT)).toBeVisible()
    await expect(page.getByText(/shouldn.t be given a department/)).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/1-settings-departments.png`, fullPage: true })

    const s = await getTestSession(page)
    await goto(page, `/settings/staff?staff=${s.staffId}`)
    const tick = page.getByRole('button', { name: DEPT })
    await expect(tick).toBeVisible()
    await expect(page.getByText(/leave all departments unticked/)).toBeVisible()
    if (SHOTS) await page.getByText('Access & departments').scrollIntoViewIfNeeded()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/2-staff-departments.png` })
  })

  for (const [path, name] of [['/cleaning', 'cleaning'], ['/tasks', 'tasks'], ['/opening-closing', 'opening'], ['/dashboard', 'dashboard']] as const) {
    test(`manager can switch ${name} between departments`, async ({ page }) => {
      await goto(page, path)
      const filter = page.getByRole('group', { name: 'Department' })
      const all  = filter.getByRole('button', { name: 'All departments' })
      const dept = filter.getByRole('button', { name: DEPT })
      await expect(all).toBeVisible()
      await dept.click()
      await expect(dept).toHaveAttribute('aria-pressed', 'true')
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/3-${name}-filtered.png` })
      await all.click()
      await expect(all).toHaveAttribute('aria-pressed', 'true')
    })
  }
})
