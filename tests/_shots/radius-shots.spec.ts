import { test } from '@playwright/test'
import { goto } from '../helpers/nav'
const OUT = process.env.SHOT_DIR ?? '/private/tmp/claude-501/shots/before'
const SCREENS: [string, string][] = [
  ['dashboard', '/dashboard'], ['checks', '/checks'], ['team', '/team'], ['settings', '/settings/venue'], ['tasks','/tasks'],
]
for (const [w, h, tag] of [[375, 812, 'm'], [1440, 900, 'd']] as const) {
  for (const [name, path] of SCREENS) {
    test(`${name}-${tag}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await goto(page, path)
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: false })
    })
  }
}
for (const [w, h, tag] of [[375, 812, 'm'], [1440, 900, 'd']] as const) {
  test(`modal-${tag}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h }); await goto(page, '/opening-closing')
    await page.getByRole('button', { name: /export/i }).first().click()
    await page.waitForTimeout(1000); await page.screenshot({ path: `${OUT}/modal-${tag}.png` })
  })
}
