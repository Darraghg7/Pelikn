import { describe, expect, it } from 'vitest'
import { billingAccess, staffLimit, type VenueBilling } from '../billing'

const NOW = new Date('2026-10-01T12:00:00Z').getTime()

const base: VenueBilling = {
  managed: true,
  plan: 'starter',
  trial_ends_at: null,
  subscription_status: null,
  billing_interval: null,
  current_period_end: null,
  cancel_at_period_end: false,
  has_subscription: false,
  venue_count: 1,
  active_staff: 0,
}
const make = (over: Partial<VenueBilling>) => ({ ...base, ...over })

describe('billingAccess', () => {
  it('fails open with no data', () => {
    expect(billingAccess(null, NOW)).toEqual({ state: 'unmanaged' })
    expect(billingAccess(undefined, NOW)).toEqual({ state: 'unmanaged' })
  })

  it('never locks a venue that predates billing', () => {
    expect(billingAccess(make({ managed: false, trial_ends_at: '2020-01-01T00:00:00Z' }), NOW))
      .toEqual({ state: 'unmanaged' })
  })

  it('counts trial days up, rounding a part day to a whole one', () => {
    const endsAt = '2026-10-03T13:00:00Z' // 2 days 1 hour away
    expect(billingAccess(make({ trial_ends_at: endsAt }), NOW)).toEqual({ state: 'trial', daysLeft: 3, endsAt })
  })

  it('locks when the trial ends with no subscription', () => {
    expect(billingAccess(make({ trial_ends_at: '2026-10-01T11:59:00Z' }), NOW))
      .toEqual({ state: 'locked', reason: 'trial_ended' })
  })

  it('stays open once subscribed, including a card-on-file trial', () => {
    for (const s of ['active', 'trialing']) {
      expect(billingAccess(make({ subscription_status: s, trial_ends_at: '2026-01-01T00:00:00Z' }), NOW))
        .toEqual({ state: 'subscribed' })
    }
  })

  it('keeps a past-due venue open while Stripe retries the card', () => {
    expect(billingAccess(make({ subscription_status: 'past_due' }), NOW)).toEqual({ state: 'past_due' })
  })

  it('locks a cancelled or unpaid subscription after the trial', () => {
    const ended = { trial_ends_at: '2026-09-01T00:00:00Z' }
    expect(billingAccess(make({ ...ended, subscription_status: 'canceled' }), NOW))
      .toEqual({ state: 'locked', reason: 'cancelled' })
    expect(billingAccess(make({ ...ended, subscription_status: 'unpaid' }), NOW))
      .toEqual({ state: 'locked', reason: 'payment_failed' })
  })

  it('honours the rest of the trial after cancelling during it', () => {
    const endsAt = '2026-10-05T12:00:00Z'
    expect(billingAccess(make({ trial_ends_at: endsAt, subscription_status: 'canceled' }), NOW))
      .toEqual({ state: 'trial', daysLeft: 4, endsAt })
  })
})

describe('staffLimit', () => {
  it('limits Starter venues on billing to 5', () => {
    expect(staffLimit(make({ plan: 'starter' }))).toBe(5)
  })
  it('does not limit Pro, unmanaged venues or missing data', () => {
    expect(staffLimit(make({ plan: 'pro' }))).toBeNull()
    expect(staffLimit(make({ managed: false }))).toBeNull()
    expect(staffLimit(null)).toBeNull()
  })
})
