import { test } from '@playwright/test'
import { goto } from '../helpers/nav'
import { injectManagerSession } from '../helpers/auth-bypass'
const OUT = '/private/tmp/claude-501/shots/after2'
const KEY = process.env.THEME_KEY ?? 'pelikn_theme_mode'
for (const theme of ['light', 'dark']) for (const [w, h, tag] of [[375, 812, 'm'], [1440, 900, 'd']] as const) {
  for (const [name, path] of [['dashboard', '/dashboard'], ['checks', '/checks'], ['team', '/team'], ['training', '/training']]) {
    test(`${name}-${tag}-${theme}`, async ({ page }) => {
      await page.addInitScript(([k, t]) => localStorage.setItem(k, t), [KEY, theme])
      await page.setViewportSize({ width: w, height: h })
      await goto(page, path); await page.waitForTimeout(700)
      await page.screenshot({ path: `${OUT}/${name}-${tag}-${theme}.png` })
      if (name === 'training') {
        await page.getByRole('button', { name: /new certificate|add certificate|\+ add|add/i }).first().click().catch(() => {})
        await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/modal-${tag}-${theme}.png` })
      }
    })
  }
}
