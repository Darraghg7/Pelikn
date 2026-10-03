/**
 * stripe-webhook — Supabase Edge Function, called by Stripe (not the app).
 *
 * Keeps billing_accounts and venues.plan in step with Stripe. verify_jwt is
 * off for this function (supabase/config.toml); the Stripe-Signature check
 * below is its only auth.
 *
 * Events to subscribe to in the Stripe Dashboard:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *
 * Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*.
 */

import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { priceTableFromEnv } from '../_shared/billingPlan.ts'
import { ownerForSubscription, stripeClient, syncSubscription } from '../_shared/stripeSync.ts'

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const prices = priceTableFromEnv(name => Deno.env.get(name))
const stripe = stripeClient()

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, req.headers.get('stripe-signature') ?? '', STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  let subscriptionId: string | null = null
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session
      subscriptionId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id ?? null
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      subscriptionId = (event.data.object as Stripe.Subscription).id
      break
    default:
      return new Response(JSON.stringify({ received: true, ignored: event.type }), { status: 200 })
  }
  if (!subscriptionId) return new Response(JSON.stringify({ received: true }), { status: 200 })

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  try {
    // Re-read from Stripe instead of trusting the event payload: deliveries
    // can arrive out of order, and the latest state is what we want stored.
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const ownerId = await ownerForSubscription(db, sub)
    if (!ownerId) {
      console.error(`stripe-webhook: no owner for subscription ${sub.id} (customer ${sub.customer})`)
      // 200 so Stripe doesn't retry forever; this needs a human.
      return new Response(JSON.stringify({ received: true, unmatched: true }), { status: 200 })
    }
    await syncSubscription(db, prices, ownerId, sub)
  } catch (err) {
    console.error('stripe-webhook: handler error', err)
    return new Response('Handler error', { status: 500 }) // Stripe retries
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
})
