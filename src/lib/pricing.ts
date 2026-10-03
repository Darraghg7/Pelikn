// Display strings (include currency symbol)
export const STARTER_PRICE     = '£10'
export const PRO_PRICE         = '£25'
export const EXTRA_VENUE_PRICE = '£15'
export const QR_ADDON_PRICE    = '£1'

// Numeric values for calculations (no symbol)
export const STARTER_PRICE_NUM     = 10
export const PRO_PRICE_NUM         = 25
export const EXTRA_VENUE_PRICE_NUM = 15
export const QR_ADDON_PRICE_NUM    = 1

// Annual pricing — pay 10 months upfront, get 12 months of service
export const STARTER_ANNUAL         = '£100'
export const PRO_ANNUAL             = '£250'
export const EXTRA_VENUE_ANNUAL     = '£150'
export const STARTER_ANNUAL_NUM     = 100
export const PRO_ANNUAL_NUM         = 250
export const EXTRA_VENUE_ANNUAL_NUM = 150
export const QR_ADDON_ANNUAL        = '£10'
export const QR_ADDON_ANNUAL_NUM    = 10

/**
 * What a plan costs per billing period, in pounds. Mirrors buildLineItems in
 * supabase/functions/_shared/billingPlan.ts: Starter is per venue; Pro is the
 * first venue plus EXTRA_VENUE for each other one.
 */
export function planTotal(plan: 'starter' | 'pro', interval: 'month' | 'year', venueCount: number, qrAddon = false): number {
  const annual = interval === 'year'
  const venues = Math.max(1, Math.floor(venueCount))
  const base = plan === 'pro'
    ? (annual ? PRO_ANNUAL_NUM : PRO_PRICE_NUM) + (venues - 1) * (annual ? EXTRA_VENUE_ANNUAL_NUM : EXTRA_VENUE_PRICE_NUM)
    : (annual ? STARTER_ANNUAL_NUM : STARTER_PRICE_NUM) * venues
  return base + (qrAddon ? (annual ? QR_ADDON_ANNUAL_NUM : QR_ADDON_PRICE_NUM) : 0)
}
