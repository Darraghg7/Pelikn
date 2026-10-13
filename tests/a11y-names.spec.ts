/**
 * Accessible names — every button, link, switch and form field on the main
 * screens must have a name a screen reader or voice-control user can use
 * ("Close", "Previous week"), not just "button".
 *
 * Walks the live DOM on each screen (desktop and 375px phone), works out each
 * interactive element's accessible name roughly the way a browser does, and
 * fails listing any that have none. Set A11Y_REPORT=<file> to also write the
 * counts as JSON. The static check in `npm run lint:a11y` catches new ones at
 * code-review time; this one catches what only shows once the data is loaded.
 */
import { test, expect } from './helpers/cleanup'
import { goto } from './helpers/nav'
import { writeFileSync } from 'node:fs'

const SCREENS: Array<[string, string]> = [
  ['dashboard', '/dashboard'],
  ['checks hub', '/checks'],
  ['cleaning', '/cleaning'],
  ['opening & closing', '/opening-closing'],
  ['clock-in', '/clock-in'],
  ['rota', '/rota'],
  ['team hub', '/team'],
  ['team: staff', '/staff'],
  ['time off', '/time-off'],
  ['tasks', '/tasks'],
  ['fridge', '/fridge'],
  ['allergens', '/allergens'],
  ['settings hub', '/settings/hub'],
  ['settings: venue', '/settings/venue'],
  ['settings: attendance', '/settings/attendance'],
  ['settings: compliance', '/settings/compliance'],
  ['settings: hub tiles', '/settings/hub-tiles'],
]
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone 375px', width: 375, height: 812 },
]

/** Runs in the page: returns a description of each visible interactive element with no accessible name. */
function findUnnamed() {
  const sel = 'button, a[href], [role="button"], [role="switch"], [role="checkbox"], [role="tab"], [role="menuitem"], input:not([type="hidden"]), select, textarea, img'
  const visible = (el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect()
    const s = getComputedStyle(el)
    return (r.width > 0 || r.height > 0) && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const textOf = (el: Element) => (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || ''
  const nameOf = (el: Element): string => {
    const aria = el.getAttribute('aria-label')?.trim()
    if (aria) return aria
    const by = el.getAttribute('aria-labelledby')
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim()
      if (t) return t
    }
    const tag = el.tagName.toLowerCase()
    if (tag === 'img') return el.getAttribute('alt') !== null ? 'alt' : ''
    if (['input', 'select', 'textarea'].includes(tag)) {
      const input = el as HTMLInputElement
      if (input.type === 'submit' || input.type === 'button') return input.value
      const labels = (input as any).labels as NodeListOf<HTMLLabelElement> | null
      if (labels && Array.from(labels).some((l) => textOf(l))) return 'label'
      if (el.getAttribute('title') || el.getAttribute('placeholder')) return 'title'
      return ''
    }
    if (textOf(el)) return textOf(el)
    if (el.querySelector('img[alt]:not([alt=""])')) return 'img alt'
    if (el.querySelector('svg title')) return 'svg title'
    if (el.getAttribute('title')) return el.getAttribute('title')!
    return ''
  }
  const out: string[] = []
  for (const el of Array.from(document.querySelectorAll(sel))) {
    if (!visible(el) || el.closest('[aria-hidden="true"]')) continue
    if (nameOf(el)) continue
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).slice(0, 4).join('.')
    out.push(`<${el.tagName.toLowerCase()}${el.getAttribute('type') ? ` type=${el.getAttribute('type')}` : ''}> .${cls}`)
  }
  return out
}

const STAFF_SCREENS: Array<[string, string]> = [
  ['dashboard', '/dashboard'],
  ['cleaning', '/cleaning'],
  ['opening & closing', '/opening-closing'],
  ['clock-in', '/clock-in'],
  ['rota', '/rota'],
  ['time off', '/time-off'],
  ['tasks', '/tasks'],
  ['noticeboard', '/noticeboard'],
  ['fridge', '/fridge'],
]

// Screens whose "add / new / log" buttons open a dialog or sheet.
const DIALOG_SCREENS = ['/corrective', '/complaints', '/recall', '/rota', '/time-off', '/training', '/waste', '/equipment-maintenance',
  '/date-labelling', '/cleaning', '/probe', '/documents', '/staff', '/suppliers', '/orders', '/incidents', '/tips', '/fridge/history', '/pest-control']

const report: Record<string, number> = {}

for (const vp of VIEWPORTS) {
  test.describe(`accessible names — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })
    for (const [name, path] of SCREENS) {
      test(name, async ({ page }) => {
        await goto(page, path)
        const unnamed = await page.evaluate(findUnnamed)
        report[`${vp.name} | ${name}`] = unnamed.length
        if (process.env.A11Y_REPORT) writeFileSync(process.env.A11Y_REPORT, JSON.stringify({ report, last: { name, unnamed } }, null, 1))
        if (process.env.A11Y_REPORT) console.log(`UNNAMED ${vp.name} | ${name}: ${unnamed.length}\n  ${unnamed.join('\n  ')}`)
        expect(unnamed, `Controls with no accessible name on ${name}`).toEqual([])
      })
    }
  })
}

test('a modal is labelled, keeps focus inside, closes on Escape and gives focus back', async ({ page }) => {
  // Corrective actions' "Log Issue" opens a plain Modal.
  await goto(page, '/corrective')
  const opener = page.getByRole('button', { name: /log issue/i }).first()
  await opener.focus()
  await opener.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleName(/.+/)
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

for (const vp of VIEWPORTS) {
  test.describe(`accessible names, staff and signed-out — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('PIN login screen', async ({ page }) => {
      await goto(page, '', { signedOut: true })
      await page.getByRole('button').first().waitFor({ timeout: 15000 })
      expect(await page.getByRole('button').count(), 'login screen should list people').toBeGreaterThan(2)
      let unnamed = await page.evaluate(findUnnamed)
      expect(unnamed, 'Controls with no accessible name on the login screen').toEqual([])
      // Pick the first person to bring up the PIN pad, and check that too.
      await page.getByRole('button').first().click()
      await page.waitForTimeout(500)
      unnamed = await page.evaluate(findUnnamed)
      expect(unnamed, 'Controls with no accessible name on the PIN pad').toEqual([])
    })

    for (const [name, path] of STAFF_SCREENS) {
      test(`as staff: ${name}`, async ({ page }) => {
        await goto(page, path, { asStaff: true })
        expect(await page.evaluate(() => localStorage.getItem('pelikn_staff_role'))).not.toBe('manager')
        const unnamed = await page.evaluate(findUnnamed)
        expect(unnamed, `Controls with no accessible name on ${name} (staff)`).toEqual([])
      })
    }
  })
}

test.describe('accessible names — dialogs opened from "add / new / log" buttons', () => {
  test.setTimeout(240000)
  for (const vp of VIEWPORTS) {
    test(`dialogs, ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const problems: string[] = []
      let opened = 0
      for (const path of DIALOG_SCREENS) {
        await goto(page, path)
        const buttons = page.getByRole('button', { name: /^\+?\s*(add|new|log|invite|report|edit|export|record)\b/i })
        const count = Math.min(await buttons.count(), 4)
        for (let i = 0; i < count; i++) {
          const b = buttons.nth(i)
          if (!(await b.isVisible().catch(() => false))) continue
          await b.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(450)
          const dlg = page.getByRole('dialog')
          if (await dlg.count()) {
            opened++
            const unnamed = await page.evaluate(findUnnamed)
            if (unnamed.length) problems.push(`${path} → "${(await b.innerText().catch(() => '')).trim()}": ${unnamed.join('; ')}`)
            await page.keyboard.press('Escape')
            await page.waitForTimeout(350)
          }
        }
      }
      console.log(`DIALOGS ${vp.name}: opened ${opened}; problems: ${problems.length}\n${problems.join('\n')}`)
      expect(opened, 'expected to open at least a few dialogs').toBeGreaterThan(2)
      expect(problems).toEqual([])
    })
  }
})
