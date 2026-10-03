/**
 * Pure pricing logic shared by the `billing` and `stripe-webhook` edge
 * functions. No Deno or Stripe imports, so vitest can cover it
 * (see __tests__/billingPlan.test.ts).
 *
 * Price model (matches src/lib/pricing.ts and the marketing page):
 *   Starter — STARTER price × number of venues ("£10 per venue")
 *   Pro     — PRO price × 1 for the first venue + EXTRA_VENUE × the rest
 *   QR add-on — one QR_ADDON line, any plan
 * Every Stripe Price is set up twice, monthly and annual, because a Stripe
 * subscription's items must all share one billing interval.
 */

export type Plan = 'starter' | 'pro'
export type Interval = 'month' | 'year'
export type PriceKind = 'starter' | 'pro' | 'extra_venue' | 'qr_addon'
export type PriceTable = Record<Interval, Record<PriceKind, string>>

const ENV_NAMES: Record<PriceKind, string> = {
  starter:     'STARTER',
  pro:         'PRO',
  extra_venue: 'EXTRA_VENUE',
  qr_addon:    'QR_ADDON',
}

/** Reads STRIPE_PRICE_<KIND>_MONTHLY / _ANNUAL. Missing ones come back ''. */
export function priceTableFromEnv(get: (name: string) => string | undefined): PriceTable {
  const table = { month: {}, year: {} } as PriceTable
  for (const kind of Object.keys(ENV_NAMES) as PriceKind[]) {
    table.month[kind] = get(`STRIPE_PRICE_${ENV_NAMES[kind]}_MONTHLY`) ?? ''
    table.year[kind]  = get(`STRIPE_PRICE_${ENV_NAMES[kind]}_ANNUAL`) ?? ''
  }
  return table
}

export interface PlanChoice {
  plan: Plan
  interval: Interval
  venueCount: number
  qrAddon: boolean
}

export interface LineItem { price: string; quantity: number }

/** The subscription items for a plan choice. Throws if a needed price is unset. */
export function buildLineItems(prices: PriceTable, choice: PlanChoice): LineItem[] {
  const p = prices[choice.interval]
  const venues = Math.max(1, Math.floor(choice.venueCount))
  const need = (kind: PriceKind) => {
    if (!p[kind]) throw new Error(`Stripe price for ${kind} (${choice.interval}) is not configured`)
    return p[kind]
  }

  const items: LineItem[] = choice.plan === 'pro'
    ? [{ price: need('pro'), quantity: 1 }]
    : [{ price: need('starter'), quantity: venues }]
  if (choice.plan === 'pro' && venues > 1) items.push({ price: need('extra_venue'), quantity: venues - 1 })
  if (choice.qrAddon) items.push({ price: need('qr_addon'), quantity: 1 })
  return items
}

/**
 * Reverse of buildLineItems: what a live subscription's items mean. Returns
 * null when no base plan price is recognised (e.g. a price created by hand in
 * the Stripe Dashboard that isn't in the env), so callers never guess a plan.
 */
export function describeItems(
  prices: PriceTable,
  items: { price: string; quantity: number }[],
): { plan: Plan; interval: Interval; qrAddon: boolean } | null {
  for (const interval of ['month', 'year'] as Interval[]) {
    const p = prices[interval]
    const has = (kind: PriceKind) => !!p[kind] && items.some(i => i.price === p[kind])
    if (has('pro'))     return { plan: 'pro',     interval, qrAddon: has('qr_addon') }
    if (has('starter')) return { plan: 'starter', interval, qrAddon: has('qr_addon') }
  }
  return null
}

/** Whole days of trial left to carry into Checkout (0 = charge now). */
export function trialDaysLeft(trialEndsAt: string | null, now: number): number {
  if (!trialEndsAt) return 0
  const ms = new Date(trialEndsAt).getTime() - now
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0
}

/** Statuses where the owner already has a live subscription (don't start a second). */
export const LIVE_STATUSES = ['trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete']

/** Only same-site paths inside a venue are allowed as Stripe return URLs. */
export function safeReturnPath(path: unknown): string {
  return typeof path === 'string' && /^\/v\/[a-z0-9-]+\/[a-z0-9/_-]*$/i.test(path) ? path : '/'
}
