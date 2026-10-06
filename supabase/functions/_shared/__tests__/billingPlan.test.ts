import { describe, expect, it } from 'vitest'
import {
  buildLineItems, describeItems, priceTableFromEnv, safeReturnPath, trialDaysLeft,
} from '../billingPlan'

const env: Record<string, string> = {
  STRIPE_PRICE_STARTER_MONTHLY: 'p_s_m', STRIPE_PRICE_STARTER_ANNUAL: 'p_s_y',
  STRIPE_PRICE_PRO_MONTHLY: 'p_p_m', STRIPE_PRICE_PRO_ANNUAL: 'p_p_y',
  STRIPE_PRICE_EXTRA_VENUE_MONTHLY: 'p_e_m', STRIPE_PRICE_EXTRA_VENUE_ANNUAL: 'p_e_y',
  STRIPE_PRICE_QR_ADDON_MONTHLY: 'p_q_m', STRIPE_PRICE_QR_ADDON_ANNUAL: 'p_q_y',
}
const prices = priceTableFromEnv(n => env[n])

describe('buildLineItems', () => {
  it('bills Starter per venue', () => {
    expect(buildLineItems(prices, { plan: 'starter', interval: 'month', venueCount: 3, qrAddon: false }))
      .toEqual([{ price: 'p_s_m', quantity: 3 }])
  })

  it('bills Pro as first venue plus extra venues, with the QR add-on', () => {
    expect(buildLineItems(prices, { plan: 'pro', interval: 'year', venueCount: 3, qrAddon: true }))
      .toEqual([
        { price: 'p_p_y', quantity: 1 },
        { price: 'p_e_y', quantity: 2 },
        { price: 'p_q_y', quantity: 1 },
      ])
  })

  it('never bills fewer than one venue', () => {
    expect(buildLineItems(prices, { plan: 'pro', interval: 'month', venueCount: 0, qrAddon: false }))
      .toEqual([{ price: 'p_p_m', quantity: 1 }])
  })

  it('refuses rather than silently dropping an unconfigured price', () => {
    const partial = priceTableFromEnv(n => (n.includes('EXTRA') ? undefined : env[n]))
    expect(() => buildLineItems(partial, { plan: 'pro', interval: 'month', venueCount: 2, qrAddon: false }))
      .toThrow(/extra_venue/)
  })
})

describe('describeItems', () => {
  it('reads back plan, interval and add-on', () => {
    expect(describeItems(prices, [{ price: 'p_p_y', quantity: 1 }, { price: 'p_q_y', quantity: 1 }]))
      .toEqual({ plan: 'pro', interval: 'year', qrAddon: true })
    expect(describeItems(prices, [{ price: 'p_s_m', quantity: 2 }]))
      .toEqual({ plan: 'starter', interval: 'month', qrAddon: false })
  })

  it('returns null for a price it does not know', () => {
    expect(describeItems(prices, [{ price: 'price_made_by_hand', quantity: 1 }])).toBeNull()
  })

  it('round-trips buildLineItems', () => {
    const choice = { plan: 'pro' as const, interval: 'month' as const, venueCount: 2, qrAddon: false }
    expect(describeItems(prices, buildLineItems(prices, choice))).toEqual({ plan: 'pro', interval: 'month', qrAddon: false })
  })
})

describe('trialDaysLeft', () => {
  const now = new Date('2026-10-01T12:00:00Z').getTime()
  it('carries part days over as whole days', () => {
    expect(trialDaysLeft('2026-10-01T13:00:00Z', now)).toBe(1)
    expect(trialDaysLeft('2026-10-08T12:00:00Z', now)).toBe(7)
  })
  it('is 0 once the trial is over or absent', () => {
    expect(trialDaysLeft('2026-09-30T12:00:00Z', now)).toBe(0)
    expect(trialDaysLeft(null, now)).toBe(0)
  })
})

describe('safeReturnPath', () => {
  it('allows in-app venue paths', () => {
    expect(safeReturnPath('/v/the-corner-cup/settings/billing')).toBe('/v/the-corner-cup/settings/billing')
  })
  it('rejects anything that could leave the site', () => {
    for (const bad of ['//evil.com/v/x/', 'https://evil.com', '/v/x/../../', '/login', 42, null]) {
      expect(safeReturnPath(bad)).toBe('/')
    }
  })
})
