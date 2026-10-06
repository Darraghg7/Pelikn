/**
 * billing — Supabase Edge Function. Everything the owner does with billing.
 *
 * POST { action, venueId, ... }
 * Authorization: Bearer <venue owner's Supabase Auth access token>
 *
 *   checkout     { plan, interval, returnPath } → { url }
 *     Stripe Checkout for an owner with no live subscription. Carries the
 *     rest of the free trial over, so the card isn't charged until it ends.
 *   change_plan  { plan }                       → { ok }
 *     Switch Starter ↔ Pro on a live subscription, prorated.
 *   sync_venues  {}                             → { ok }
 *     Re-price after a venue is added (venue count drives the quantities).
 *   portal       { returnPath }                 → { url }
 *     Stripe Customer Portal: card, invoices, cancel.
 *
 * Only the venue's owner (venues.owner_id) may call it. PIN sessions can't:
 * a manager's PIN doesn't identify who pays.
 *
 * Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_* (see docs/stripe-billing-setup.md).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildLineItems, priceTableFromEnv, safeReturnPath, trialDaysLeft, LIVE_STATUSES,
  type Interval, type Plan,
} from '../_shared/billingPlan.ts'
import { stripeClient, stripeConfigured, syncSubscription } from '../_shared/stripeSync.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SITE_URL         = Deno.env.get('SITE_URL') ?? 'https://get-pelikn.com'

const ALLOWED_ORIGINS = [
  'https://get-pelikn.com',
  'https://pelikn.vercel.app',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
]

const prices = priceTableFromEnv(name => Deno.env.get(name))

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'Sign in with your owner email to manage billing')

    const body = await req.json()
    const { action, venueId } = body ?? {}
    if (!venueId || typeof action !== 'string') throw new HttpError(400, 'Invalid request')

    if (!stripeConfigured()) {
      console.error('billing: STRIPE_SECRET_KEY is not set')
      throw new HttpError(503, "Payments aren't switched on yet. Email hello@get-pelikn.com and we'll sort it.")
    }
    const stripe = stripeClient()

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    const { data: userData, error: userErr } = await db.auth.getUser(token)
    if (userErr || !userData?.user) throw new HttpError(401, 'Sign in with your owner email to manage billing')
    const user = userData.user

    const { data: venue } = await db
      .from('venues')
      .select('id, name, owner_id, qr_addon')
      .eq('id', venueId)
      .maybeSingle()
    if (!venue) throw new HttpError(404, 'Venue not found')
    if (venue.owner_id !== user.id) throw new HttpError(403, 'Only the venue owner can manage billing')

    const { data: account } = await db
      .from('billing_accounts')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!account) {
      throw new HttpError(409, 'Your account is billed directly. Email hello@get-pelikn.com to make changes.')
    }

    const { count: venueCount } = await db
      .from('venues')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)

    const isLive = !!account.stripe_subscription_id && LIVE_STATUSES.includes(account.subscription_status ?? '')

    switch (action) {
      case 'checkout': {
        const plan: Plan = body.plan === 'pro' ? 'pro' : 'starter'
        const interval: Interval = body.interval === 'year' ? 'year' : 'month'
        if (isLive) throw new HttpError(409, 'You already have a subscription. Change plan instead.')

        let customerId: string | null = account.stripe_customer_id
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email ?? undefined,
            name: venue.name,
            metadata: { owner_id: user.id },
          })
          customerId = customer.id
          await db.from('billing_accounts')
            .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
            .eq('owner_id', user.id)
        }

        const days = trialDaysLeft(account.trial_ends_at, Date.now())
        const base = `${SITE_URL}${safeReturnPath(body.returnPath)}`
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer: customerId,
          line_items: buildLineItems(prices, {
            plan, interval, venueCount: venueCount ?? 1, qrAddon: !!venue.qr_addon,
          }),
          subscription_data: {
            metadata: { owner_id: user.id },
            ...(days > 0 ? { trial_period_days: days } : {}),
          },
          metadata: { owner_id: user.id },
          allow_promotion_codes: true,
          billing_address_collection: 'auto',
          success_url: `${base}?billing=success`,
          cancel_url: `${base}?billing=cancelled`,
        })
        return json({ url: session.url })
      }

      case 'change_plan':
      case 'sync_venues': {
        if (!isLive) {
          if (action === 'sync_venues') return json({ ok: true }) // nothing to re-price yet
          throw new HttpError(409, 'Add a payment method first')
        }
        const sub = await stripe.subscriptions.retrieve(account.stripe_subscription_id)
        const currentPlan: Plan = sub.items.data.some(i => i.price.id === prices.month.pro || i.price.id === prices.year.pro)
          ? 'pro' : 'starter'
        const plan: Plan = action === 'change_plan' ? (body.plan === 'pro' ? 'pro' : 'starter') : currentPlan
        const interval: Interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'year' : 'month'
        const qrAddon = sub.items.data.some(i => i.price.id === prices[interval].qr_addon)

        const wanted = buildLineItems(prices, { plan, interval, venueCount: venueCount ?? 1, qrAddon })
        // Keep items whose price is still wanted (update quantity), delete the rest, add new ones.
        const items: { id?: string; price?: string; quantity?: number; deleted?: boolean }[] = []
        for (const existing of sub.items.data) {
          const match = wanted.find(w => w.price === existing.price.id)
          items.push(match ? { id: existing.id, quantity: match.quantity } : { id: existing.id, deleted: true })
        }
        for (const w of wanted) {
          if (!sub.items.data.some(e => e.price.id === w.price)) items.push(w)
        }

        const updated = await stripe.subscriptions.update(sub.id, {
          items,
          proration_behavior: 'create_prorations',
          metadata: { owner_id: user.id },
        })
        await syncSubscription(db, prices, user.id, updated)
        return json({ ok: true })
      }

      case 'portal': {
        if (!account.stripe_customer_id) throw new HttpError(409, 'Add a payment method first')
        const portal = await stripe.billingPortal.sessions.create({
          customer: account.stripe_customer_id,
          return_url: `${SITE_URL}${safeReturnPath(body.returnPath)}`,
        })
        return json({ url: portal.url })
      }

      default:
        throw new HttpError(400, 'Unknown action')
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    console.error('billing error:', err)
    return json({ error: 'Something went wrong with billing. Please try again.' }, 500)
  }
})
