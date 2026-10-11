import { test } from '@playwright/test'
import { goto } from '../helpers/nav'
for (const theme of ['light','dark']) for (const [w,h,tag] of [[375,812,'m'],[1440,900,'d']] as const)
test(`m-${tag}-${theme}`, async ({ page }) => {
  await page.addInitScript(([k,t]) => localStorage.setItem(k,t), ['pelikn_theme_mode', theme])
  await page.setViewportSize({ width: w, height: h }); await goto(page, '/staff')
  await page.getByRole('button', { name: /add staff/i }).first().click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `/private/tmp/claude-501/shots/after2/addstaff-${tag}-${theme}.png` })
})
