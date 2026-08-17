/**
 * Staff Members settings section — smoke coverage for the write-relocation
 * refactor (raw supabase.from()/.rpc() calls, including two dynamic-RPC-name
 * dispatches, moved into lib/api/staffManagement.ts). Crash-test level, same
 * rationale as tests/rota-smoke.spec.ts: mechanical relocation, not new logic.
 */
import { test, expect } from '@playwright/test'
import { goto } from './helpers/nav'
import { injectManagerSession } from './helpers/auth-bypass'

test.describe('Staff Members settings — smoke (no real data, mocked auth only)', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await goto(page, '/settings/staff')
  })

  test('page renders without a crash or broken import', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Something went wrong')
    await expect(page.locator('body')).not.toContainText('is not a function')
    await expect(page.locator('body')).not.toContainText('is not defined')
  })

  test('Add staff opens the form without throwing', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add staff|new staff|\+ staff/i }).first()
    if (await addBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await addBtn.click()
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    }
  })
})
