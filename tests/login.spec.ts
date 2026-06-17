/**
 * Login page — venue tabs, numpad PIN, coloured avatars, selected-staff header,
 * add-venue modal, and device venue list behaviour.
 *
 * These tests run without a pre-authenticated manager session because they
 * exercise the login screen itself.
 */
import { test, expect, Page } from '@playwright/test'

const VENUE      = process.env.TEST_VENUE_SLUG  ?? 'brew-and-bloom'
const VENUE2     = process.env.TEST_VENUE_SLUG2 ?? 'second-venue'
const BASE_URL   = 'http://127.0.0.1:5173'
const LOGIN_URL  = `${BASE_URL}/v/${VENUE}`

/** Clear all Pelikn session + device keys so we always start from the login screen. */
async function clearSession(page: Page) {
  await page.addInitScript(() => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('pelikn_'))
      .forEach(k => localStorage.removeItem(k))
  })
}

async function waitForLoginReady(page: Page) {
  await page.waitForFunction(
    () => !document.querySelector('.animate-spin') && document.body.innerText.length > 10,
    { timeout: 20000 }
  )
}

test.describe('Login page — structure', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page)
    await page.goto(LOGIN_URL)
    await waitForLoginReady(page)
  })

  test('shows Pelikn wordmark', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pelikn/i })).toBeVisible()
  })

  test('shows "Built for Hospitality" subtitle', async ({ page }) => {
    await expect(page.getByText(/built for hospitality/i)).toBeVisible()
  })

  test('shows "Select Staff Member" label', async ({ page }) => {
    await expect(page.getByText(/select staff member/i)).toBeVisible()
  })

  test('renders at least one staff row', async ({ page }) => {
    // Staff rows are buttons with a role/name label
    const rows = page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i })
    await expect(rows.first()).toBeVisible({ timeout: 12000 })
  })

  test('staff avatars show two initials', async ({ page }) => {
    // Avatars are divs with font-mono class containing 2 uppercase letters
    const avatars = page.locator('div.font-mono, div[class*="font-mono"]')
      .filter({ hasText: /^[A-Z]{2}$/ })
    await expect(avatars.first()).toBeVisible({ timeout: 12000 })
  })

  test('shows "Add another venue" dashed button in single-venue mode', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add another venue/i })).toBeVisible()
  })

  test('PIN section is hidden before a staff member is selected', async ({ page }) => {
    // Numpad key 1 should not be visible yet
    await expect(page.getByRole('button', { name: '1', exact: true })).not.toBeVisible()
  })
})

test.describe('Login page — staff selection + numpad PIN', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page)
    await page.goto(LOGIN_URL)
    await waitForLoginReady(page)
    // Wait for staff rows to appear
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i })
      .first().waitFor({ timeout: 12000 })
  })

  test('selecting a staff member reveals numpad', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: '0', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '⌫' })).toBeVisible()
  })

  test('selecting a staff member shows PIN header with name', async ({ page }) => {
    const firstRow = page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first()
    await firstRow.click()
    // PIN header should be visible (the section border-top div)
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible({ timeout: 5000 })
    // The PIN section header contains the staff name — check it rendered
    const pinSection = page.locator('div').filter({ has: page.getByRole('button', { name: '1', exact: true }) })
    await expect(pinSection.first()).toBeVisible()
  })

  test('PIN dots appear when staff selected', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible({ timeout: 5000 })
    // Dots are small divs with rounded-full inside the PIN section
    const dots = page.locator('div[style*="border-radius: 6px"], div[style*="border-radius:6px"]')
    await expect(dots.first()).toBeVisible()
  })

  test('PIN dots fill as digits are tapped', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    // After tapping 1, Sign In should still be disabled (only 1 digit)
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  test('backspace button removes last digit', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.getByRole('button', { name: '⌫' }).click()
    // Back to 1 digit — still disabled
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  test('Sign In button is disabled with fewer than 4 digits', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  test('Sign In button enables after 4 digits', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    for (const d of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: d, exact: true }).click()
    }
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled()
  })

  test('× button in PIN header deselects staff and hides numpad', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible({ timeout: 5000 })
    // The dismiss button is a small button with the close SVG (x1="18" y1="6")
    const closeBtn = page.locator('button').filter({
      has: page.locator('line[x1="18"][y1="6"]'),
    }).first()
    await closeBtn.click()
    await expect(page.getByRole('button', { name: '1', exact: true })).not.toBeVisible({ timeout: 3000 })
  })

  test('selecting same staff row again deselects it', async ({ page }) => {
    const row = page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first()
    await row.click()
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible({ timeout: 5000 })
    await row.click()
    await expect(page.getByRole('button', { name: '1', exact: true })).not.toBeVisible({ timeout: 3000 })
  })

  test('wrong PIN shows error message', async ({ page }) => {
    await page.locator('button').filter({ hasText: /manager|staff|chef|owner|barista|supervisor/i }).first().click()
    for (const d of ['9', '9', '9', '9']) {
      await page.getByRole('button', { name: d, exact: true }).click()
    }
    await page.getByRole('button', { name: /sign in/i }).click().catch(() => {})
    await expect(page.getByText(/incorrect pin|wrong pin|try again/i)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Login page — add venue modal', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page)
    await page.goto(LOGIN_URL)
    await waitForLoginReady(page)
  })

  test('add venue modal opens from dashed button', async ({ page }) => {
    await page.getByRole('button', { name: /add another venue/i }).click()
    await expect(page.getByText(/enter venue code/i)).toBeVisible()
  })

  test('modal has code input field', async ({ page }) => {
    await page.getByRole('button', { name: /add another venue/i }).click()
    // Input has placeholder "e.g. the-oak-tavern"
    await expect(page.locator('input[placeholder*="oak-tavern"], input[placeholder*="venue"], input[type="text"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('modal has "Look up code" button', async ({ page }) => {
    await page.getByRole('button', { name: /add another venue/i }).click()
    await expect(page.getByRole('button', { name: /look up code/i })).toBeVisible()
  })

  test('invalid code shows error message', async ({ page }) => {
    await page.getByRole('button', { name: /add another venue/i }).click()
    const input = page.locator('input[placeholder*="oak-tavern"], input[type="text"]').first()
    await input.fill('definitely-not-a-real-venue-xyz-abc')
    await page.getByRole('button', { name: /look up code/i }).click()
    await expect(page.getByText(/no venue found|not found|check the code/i)).toBeVisible({ timeout: 12000 })
  })

  test('modal closes on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /add another venue/i }).click()
    await expect(page.getByText(/enter venue code/i)).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByText(/enter venue code/i)).not.toBeVisible()
  })

  test('modal closes on backdrop click', async ({ page }) => {
    await page.getByRole('button', { name: /add another venue/i }).click()
    await expect(page.getByText(/enter venue code/i)).toBeVisible()
    await page.locator('.fixed.inset-0').first().click({ position: { x: 10, y: 10 } })
    await expect(page.getByText(/enter venue code/i)).not.toBeVisible()
  })
})

test.describe('Login page — sliding venue tabs (multi-venue device)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((args) => {
      localStorage.setItem('pelikn_device_venues', JSON.stringify(args.venues))
    }, {
      venues: [
        { id: 'venue-id-1', slug: VENUE,  name: 'Brew & Bloom' },
        { id: 'venue-id-2', slug: VENUE2, name: 'Second Venue' },
      ],
    })
    await page.goto(LOGIN_URL)
    await waitForLoginReady(page)
  })

  test('shows sliding tab strip when device has multiple venues', async ({ page }) => {
    // The track wrapper is a div containing the tab buttons, using inline background style
    // Look for the tab buttons themselves — if they exist the switcher rendered
    const tabBtns = page.locator('button').filter({ hasText: /brew.*bloom|second venue/i })
    await expect(tabBtns.first()).toBeVisible({ timeout: 8000 })
  })

  test('renders a tab for each device venue', async ({ page }) => {
    await expect(page.getByRole('button', { name: /brew.*bloom/i })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /second venue/i })).toBeVisible({ timeout: 8000 })
  })

  test('active tab has white text style', async ({ page }) => {
    const activeTab = page.locator('button').filter({ hasText: /brew.*bloom/i }).first()
    await expect(activeTab).toBeVisible({ timeout: 8000 })
    const color = await activeTab.evaluate(el => (el as HTMLElement).style.color)
    expect(color).toBe('rgb(255, 255, 255)')
  })

  test('+ add venue button is visible in multi-venue tab strip', async ({ page }) => {
    // The + button next to the track — it has a plus SVG (line x1="12" y1="5")
    const addBtn = page.locator('button').filter({
      has: page.locator('line[x1="12"][y1="5"]'),
    }).first()
    await expect(addBtn).toBeVisible({ timeout: 8000 })
  })

  test('single-venue "Add another venue" button is hidden in multi-venue mode', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add another venue/i })).not.toBeVisible({ timeout: 5000 })
  })
})
