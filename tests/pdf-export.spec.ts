/**
 * PDF exports — the jsPDF chunk is ~800 kB and only downloads when somebody
 * exports. This locks in three things: the chunk is NOT fetched just by
 * opening the audit page, an export produces a real PDF, and when the chunk
 * can't be fetched (offline) the user gets a toast rather than a dead button.
 */
import { test, expect } from './helpers/cleanup'
import type { Page } from '@playwright/test'
import { goto } from './helpers/nav'
import { injectManagerSession } from './helpers/auth-bypass'

const SUPABASE_URL = 'https://djwgyyerxvxovicixxrp.supabase.co'
const FRIDGE = { id: 'fridge-1', name: 'Walk-in', min_temp: 0, max_temp: 5 }
const TEMP_LOGS = [
  { id: 't1', temperature: 3, logged_at: '2026-08-15T08:00:00Z', exceedance_reason: null, logged_by_name: 'A', is_resolved: false, fridge: FRIDGE },
]

async function mockTables(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/fridge_temperature_logs?*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TEMP_LOGS) }))
  for (const table of ['cleaning_tasks', 'cleaning_completions', 'delivery_checks', 'probe_calibrations', 'corrective_actions', 'staff_training', 'staff']) {
    await page.route(`${SUPABASE_URL}/rest/v1/${table}?*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  }
}

test.describe('PDF export loads its library on demand', () => {
  test.beforeEach(async ({ page }) => {
    await injectManagerSession(page)
    await mockTables(page)
  })

  test('opening the audit page does not fetch the PDF library; exporting does, and yields a PDF', async ({ page }) => {
    const pdfRequests: string[] = []
    page.on('request', r => { if (/jspdf|pdf-vendor/.test(r.url())) pdfRequests.push(r.url()) })
    await goto(page, '/audit')
    await expect(page.getByText('Total readings')).toBeVisible({ timeout: 10000 })
    expect(pdfRequests).toHaveLength(0)

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: /Temp Logs/ }).click(),
    ])
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdfRequests.length).toBeGreaterThan(0)
  })

  test('shows a message when the PDF library cannot be fetched', async ({ page }) => {
    await page.route(/jspdf|pdf-vendor/, route => route.abort('internetdisconnected'))
    await goto(page, '/audit')
    await expect(page.getByText('Total readings')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Temp Logs/ }).click()
    await expect(page.getByText(/Couldn.t create the report/)).toBeVisible({ timeout: 15000 })
  })
})
