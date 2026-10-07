/**
 * Saving a person, then reopening them straight away, must show what was
 * just saved.
 *
 * "Save changes" closes the person and refetches the staff list in the
 * background. Before the fix, reopening them before that refetch landed
 * filled the form from the old cached list — pay saved as 11.75 came back as
 * 0, and saving again would have written 0 over it. On a fast connection the
 * refetch usually wins, so this test holds it back for a few seconds to make
 * the race happen every time.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'
import { SUPABASE_URL } from './helpers/auth-bypass'

const PERSON = uniq('Pay Reopen Tester')

test('a saved pay change shows when the person is reopened immediately', async ({ page }) => {
  await goto(page, '/staff')

  // Create someone to edit (deleted again by the cleanup fixture).
  await page.getByRole('button', { name: /add staff/i }).first().click()
  await page.getByPlaceholder(/full name/i).first().fill(PERSON)
  await page.getByLabel(/^pin$/i).first().fill(String(1000 + Math.floor(Math.random() * 9000)))
  await page.getByRole('button', { name: /^add staff member$/i }).click()

  // Creating keeps the form open on the new person, in edit mode.
  const saveBtn = page.getByRole('button', { name: /^save changes$/i })
  await expect(saveBtn).toBeVisible({ timeout: 15000 })
  // Let the post-create list refresh finish so it can't muddy the race below.
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

  // From here on, hold every staff-list fetch back for 4 seconds.
  await page.route(`${SUPABASE_URL}/rest/v1/staff?**`, async route => {
    const req = route.request()
    if (req.method() === 'GET' && new URL(req.url()).searchParams.get('select')?.includes('sort_order')) {
      await new Promise(r => setTimeout(r, 4000))
    }
    await route.fallback()
  })

  const pay = page.getByPlaceholder('e.g. 12.50')
  await pay.fill('11.75')
  await saveBtn.click()

  // Back on the list — reopen them before the delayed refetch can land.
  const row = page.getByRole('button', { name: new RegExp(PERSON) }).first()
  await expect(row).toBeVisible({ timeout: 8000 })
  await row.click()

  await expect(pay).toBeVisible({ timeout: 5000 })
  await expect(pay).toHaveValue('11.75')

  // And it still says so once the real data has arrived.
  await page.waitForTimeout(5000)
  await expect(pay).toHaveValue('11.75')
})
