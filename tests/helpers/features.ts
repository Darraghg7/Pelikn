/**
 * Optional extras (src/lib/features.ts) are off unless the venue's 'features'
 * setting lists them. These helpers serve that setting from an in-memory copy
 * and catch saves to it, so specs never change the shared test venue's real
 * switches.
 */
import type { Page } from '@playwright/test'
import { EXTRA_FEATURE_IDS } from '../../src/lib/features'

/** Serve and capture the venue's 'features' setting without touching the DB. */
export async function mockFeatures(page: Page, initial: Record<string, unknown>) {
  const state = { value: JSON.stringify(initial) }

  await page.route('**/rest/v1/rpc/get_app_bootstrap*', async route => {
    // The page may close mid-fetch at the end of a test; that's fine.
    const res = await route.fetch().catch(() => null)
    if (!res) return
    const body = await res.json().catch(() => null)
    if (!body || !Array.isArray(body.settings)) return route.fulfill({ response: res })
    body.settings = [...body.settings.filter((s: { key: string }) => s.key !== 'features'), { key: 'features', value: state.value }]
    return route.fulfill({ response: res, json: body })
  })

  await page.route(/\/rest\/v1\/app_settings\?.*key=eq\.features/, route => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ value: state.value }]) })
  })

  await page.route(/\/rest\/v1\/app_settings(\?|$)/, route => {
    const req = route.request()
    if (req.method() !== 'POST') return route.fallback()
    const row = req.postDataJSON()
    const rows = Array.isArray(row) ? row : [row]
    const features = rows.find(r => r?.key === 'features')
    if (!features) return route.fallback()
    state.value = features.value
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })

  return { extras: () => (JSON.parse(state.value).extras ?? []) as string[] }
}

/** For specs that visit an extra's page: switch every extra on for this page. */
export async function switchOnAllExtras(page: Page) {
  return mockFeatures(page, { mode: 'all', extras: EXTRA_FEATURE_IDS })
}
