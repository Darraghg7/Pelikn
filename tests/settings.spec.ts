/**
 * Settings — staff CRUD, roles, permissions, venue config.
 */
import { test, expect, uniq } from './helpers/cleanup'
import { goto } from './helpers/nav'

const TEST_STAFF = uniq('Playwright Tester')

test.describe('Settings hub', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/settings')
  })

  test('loads settings page', async ({ page }) => {
    await expect(page.getByText(/settings/i).first()).toBeVisible()
  })

  test('shows navigation tabs / sections', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /venue|roles|shifts|notifications|modules/i }).first()
    ).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Staff management', () => {
  // Staff management is at /staff (separate from /settings)
  test.beforeEach(async ({ page }) => {
    await goto(page, '/staff')
  })

  test('shows staff member list', async ({ page }) => {
    await expect(page.getByText(/sarah|james|tom|lucy/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('can open add staff form', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    // Form expands inline — look for the Name textbox
    await expect(
      page.getByPlaceholder(/full name/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('add staff form has name and PIN fields', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    // Labels are "Name *" and "PIN" as text nodes, not <label for="...">
    // Target by placeholder instead
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/^pin$/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('can create a new staff member', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()

    await page.getByPlaceholder(/full name/i).first().fill(TEST_STAFF)
    await page.getByLabel(/^pin$/i).first().fill('9876')

    await page.getByRole('button', { name: /^add staff member$/i }).click()

    // Unique per run. The old fixed "Playwright Tester" matched any of the 43
    // staff rows earlier runs had already created in this venue, so the
    // assertion passed whether or not the save actually worked.
    //
    // 15s rather than 8s because the list re-render is proportional to the
    // staff count, and this venue is still carrying ~50 leftover test rows.
    // The row was in the DOM at failure time, just past the old window. Once
    // those rows are purged this can go back down — if it ever needs raising
    // again, that is a signal the venue is filling up, not that the app slowed.
    await expect(page.getByText(TEST_STAFF)).toBeVisible({ timeout: 15000 })
  })

  test('can edit a staff member', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    if (await editBtn.count() > 0) {
      await editBtn.click()
      await expect(
        page.getByPlaceholder(/full name/i).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('staff form has contracted hours field (PR #14)', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    // Label text: "Contracted Hours / week"
    await expect(
      page.getByText(/contracted hours/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('staff form has working days selector (PR #14)', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    // Label text: "Working Days" with Mon–Sun buttons
    await expect(page.getByText(/working days/i).first()).toBeVisible({ timeout: 5000 })
    // Day-of-week buttons: Mon through Sun (use .first() in case of strict-mode duplicates)
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await expect(page.getByRole('button', { name: day }).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('staff form has contract type choice (PR #14)', async ({ page }) => {
    await page.getByRole('button', { name: /add staff/i }).first().click()
    await expect(page.getByPlaceholder(/full name/i).first()).toBeVisible({ timeout: 5000 })
    // Contract is a Full time / Part time / Zero hours segmented control
    for (const label of [/^full time$/i, /^part time$/i, /^zero hours$/i]) {
      await expect(page.getByRole('radio', { name: label })).toBeVisible({ timeout: 5000 })
    }
    // Zero hours hides the contracted-hours pattern
    await page.getByRole('radio', { name: /^zero hours$/i }).click()
    await expect(page.getByText(/contracted hours/i)).toHaveCount(0)
  })
})

test.describe('Roles management', () => {
  test('shows roles section', async ({ page }) => {
    await goto(page, '/settings')
    const rolesBtn = page.getByRole('button', { name: /roles.*skills|roles/i }).first()
    if (await rolesBtn.count() > 0) {
      await rolesBtn.click()
      await expect(
        page.getByText(/chef|kitchen|foh|barista/i).first()
      ).toBeVisible({ timeout: 6000 })
    }
  })
})

test.describe('Venue settings', () => {
  test('shows venue config section', async ({ page }) => {
    // Settings hub routes each card to its own sub-page (PR #33)
    await goto(page, '/settings/venue')
    await expect(
      page.getByText(/venue|name|logo/i).first()
    ).toBeVisible({ timeout: 6000 })
  })
})

test.describe('Permission management', () => {
  test('can view staff permissions', async ({ page }) => {
    // This had been failing for two compounding reasons: the feature was
    // renamed from "Permission Levels" to "Permission Titles" in PR #110,
    // and it lives under the Roles tab, while /settings/staff opens on
    // Members — so the old text was never on screen to begin with.
    //
    // Asserting on the section's description rather than a heading because
    // PermissionTitlesSection renders no heading of its own; the
    // "Permission Titles" label belongs to the separate SettingsPage.
    await goto(page, '/settings/staff')
    await page.getByRole('tab', { name: /^roles$/i }).click()
    await expect(
      page.getByText(/titles you assign to staff/i).first()
    ).toBeVisible({ timeout: 6000 })
  })
})
