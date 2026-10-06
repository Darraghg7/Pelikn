/**
 * Billing state as the app sees it (get_venue_billing, migration 138), and
 * the one rule that decides whether a venue is usable.
 *
 * Fails open: no data (function not applied yet, offline, error) or a venue
 * that isn't on Stripe billing ("unmanaged" — every venue created before
 * billing existed) is never locked. Locking a kitchen out of its temperature
 * logs by mistake is worse than a few days of unpaid use.
 */

/** Keep in step with enforce_starter_staff_limit() in migration 138. */
export const STARTER_STAFF_LIMIT = 5

export const TRIAL_DAYS = 7

export interface VenueBilling {
  managed: boolean
  plan: 'starter' | 'pro'
  trial_ends_at: string | null
  subscription_status: string | null
  billing_interval: 'month' | 'year' | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  has_subscription: boolean
  venue_count: number
  active_staff: number
}

export type BillingAccess =
  | { state: 'unmanaged' }
  | { state: 'trial'; daysLeft: number; endsAt: string }
  | { state: 'subscribed' }
  | { state: 'past_due' }
  | { state: 'locked'; reason: 'trial_ended' | 'payment_failed' | 'cancelled' }

const DAY_MS = 86_400_000

export function billingAccess(billing: VenueBilling | null | undefined, now: number = Date.now()): BillingAccess {
  if (!billing || !billing.managed) return { state: 'unmanaged' }

  const status = billing.subscription_status
  if (status === 'active' || status === 'trialing') return { state: 'subscribed' }
  if (status === 'past_due') return { state: 'past_due' }

  // No paying subscription: the free trial is all that keeps the venue open.
  const endsAt = billing.trial_ends_at
  const msLeft = endsAt ? new Date(endsAt).getTime() - now : 0
  if (endsAt && msLeft > 0) return { state: 'trial', daysLeft: Math.ceil(msLeft / DAY_MS), endsAt }

  if (status === 'canceled') return { state: 'locked', reason: 'cancelled' }
  if (status) return { state: 'locked', reason: 'payment_failed' }
  return { state: 'locked', reason: 'trial_ended' }
}

/** Starter venues on Stripe billing can't go past STARTER_STAFF_LIMIT. */
export function staffLimit(billing: VenueBilling | null | undefined): number | null {
  if (!billing?.managed || billing.plan !== 'starter') return null
  return STARTER_STAFF_LIMIT
}
