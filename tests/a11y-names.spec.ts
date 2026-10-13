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
