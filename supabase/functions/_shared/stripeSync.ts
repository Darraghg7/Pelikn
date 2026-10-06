/**
 * Write a Stripe subscription's state into billing_accounts and the owner's
 * venues. Used by stripe-webhook (the source of truth) and by `billing` right
 * after it changes a subscription, so the app doesn't wait on the webhook.
 *
 * Always fed a subscription freshly retrieved from Stripe, never an event's
 * embedded copy, so out-of-order webhook deliveries can't write stale state.
 */
import Stripe from 'npm:stripe@17.7.0'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { describeItems, type PriceTable } from './billingPlan.ts'

export const STRIPE_API_VERSION = '2024-06-20'

export function stripeClient(): Stripe {
  return new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    // Pinned: current_period_end still lives on the subscription in this version.
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export async function ownerForSubscription(
  db: SupabaseClient,
  sub: Stripe.Subscription,
): Promise<string | null> {
  if (sub.metadata?.owner_id) return sub.metadata.owner_id
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const { data } = await db
    .from('billing_accounts')
    .select('owner_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data?.owner_id ?? null
}

export async function syncSubscription(
  db: SupabaseClient,
  prices: PriceTable,
  ownerId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const subAny = sub as unknown as { current_period_end?: number }
  const periodEnd = subAny.current_period_end
    ?? (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end

  const { error: baErr } = await db.from('billing_accounts').upsert({
    owner_id:               ownerId,
    stripe_customer_id:     customerId,
    stripe_subscription_id: sub.id,
    subscription_status:    sub.status,
    billing_interval:       sub.items.data[0]?.price.recurring?.interval === 'year' ? 'year' : 'month',
    current_period_end:     periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end:   sub.cancel_at_period_end,
    updated_at:             new Date().toISOString(),
  })
  if (baErr) throw new Error(`billing_accounts upsert failed: ${baErr.message}`)

  // A cancelled subscription keeps its last plan: access is decided by
  // subscription_status, and keeping the plan avoids a confusing
  // "you're on Starter now" while the venue is locked anyway.
  if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return

  const described = describeItems(
    prices,
    sub.items.data.map(i => ({ price: i.price.id, quantity: i.quantity ?? 1 })),
  )
  if (!described) {
    console.error(`syncSubscription: no known plan price on ${sub.id}; plan left unchanged`)
    return
  }

  const { error: vErr } = await db
    .from('venues')
    .update({ plan: described.plan, qr_addon: described.qrAddon })
    .eq('owner_id', ownerId)
  if (vErr) throw new Error(`venues plan update failed: ${vErr.message}`)
}
