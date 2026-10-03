# Turning on Stripe billing

How self-serve billing works, and the one-time setup to switch it on. Do the
whole thing in Stripe **test mode** first, then repeat the Stripe parts in live
mode.

## How it works

- **Signup** creates a 7-day free trial. No card is asked for.
- **During the trial** the owner can add a card from Settings → Plan & Billing.
  Stripe holds the card and takes the first payment when the trial ends.
- **When the trial ends with no card**, the venue is paused. Managers see
  "Your free trial has ended" with a button to Plan & Billing. Staff see a
  message asking them to tell their manager. The records are kept.
- **Card failures** keep the venue open while Stripe retries the card (the
  manager dashboard shows a banner). If every retry fails, the venue is paused.
- **Upgrading, downgrading and adding venues** happen in the app and are
  charged or credited pro rata. Card changes, invoices and cancelling go through
  Stripe's own billing page ("Card, invoices & cancelling").
- **Starter** allows 5 active staff, not counting the owner. A sixth is
  refused with a message pointing to Pro. Pro has no limit.
- **Existing customers** (every venue created before migration 138) are not
  touched: no trial, no pause, no staff limit, and Plan & Billing tells them to
  email us. See "Moving an existing customer onto Stripe" below.

Only the venue **owner**, signed in with their email and password, can pay or
change the plan. A manager signed in with a PIN sees the plan but not the
buttons.

## One-time setup

### 1. Stripe account
Create the account at stripe.com (business details, payout bank account).
Stay in **test mode** until step 7.

### 2. Products and prices
In Stripe → Product catalogue, create four products. Give each one **two**
recurring GBP prices, monthly and yearly. Stripe needs both because every item
on a subscription must share one billing period.

| Product       | Monthly | Yearly ("2 months free") |
|---------------|---------|--------------------------|
| Starter       | £10     | £100                     |
| Pro           | £25     | £250                     |
| Extra venue   | £15     | £150                     |
| QR table cards| £1      | £10                      |

The QR yearly price (£10) is new. The app had no annual QR price before, so it
follows the same "pay for 10 months" rule. Change it if you prefer.

### 3. Tell Supabase the price IDs
Each price has an ID starting `price_`. These aren't secret. In Supabase →
Edge Functions → Secrets, add:

```
STRIPE_PRICE_STARTER_MONTHLY      STRIPE_PRICE_STARTER_ANNUAL
STRIPE_PRICE_PRO_MONTHLY          STRIPE_PRICE_PRO_ANNUAL
STRIPE_PRICE_EXTRA_VENUE_MONTHLY  STRIPE_PRICE_EXTRA_VENUE_ANNUAL
STRIPE_PRICE_QR_ADDON_MONTHLY     STRIPE_PRICE_QR_ADDON_ANNUAL
```

### 4. Secret key
Stripe → Developers → API keys → **Secret key** (`sk_test_…`). Add it as the
secret `STRIPE_SECRET_KEY`. Never paste it into chat or commit it.

### 5. Apply the migration and deploy the functions
- Apply `supabase/migrations/138_billing_accounts.sql` in the SQL editor, the
  same way as the other migrations (backup first). The rollback is
  `138_rollback.sql`.
- Deploy the two functions: `billing` and `stripe-webhook`.

The app is safe in any order. Until 138 is applied it acts as if nothing
changed: no pause, no staff limit, and Plan & Billing shows the "billed
directly" message.

### 6. Webhook
Stripe → Developers → Webhooks → Add endpoint:

- URL: `https://djwgyyerxvxovicixxrp.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`

Copy its signing secret (`whsec_…`) into the Supabase secret
`STRIPE_WEBHOOK_SECRET`.

### 7. Customer portal
Stripe → Settings → Billing → Customer portal. Turn on: update payment method,
view invoices, cancel subscriptions (**at end of billing period**, which is
what the marketing FAQ promises). Leave plan switching **off**: the app handles
that itself, so venue counts stay correct.

Also in Stripe → Settings → Billing → Subscriptions: set what happens after
every retry fails to **cancel the subscription**.

### 8. Test it end to end (test mode)
Sign up a new test venue, then:

1. Plan & Billing shows "Free trial · 7 days left".
2. Add card with Stripe's test card `4242 4242 4242 4242`. You come back to
   "Card added · first payment …".
3. Upgrade to Pro, then switch back to Starter. The plan badge updates.
4. Add a sixth staff member on Starter. It's refused with the upgrade message.
5. Open "Card, invoices & cancelling" and cancel. The status shows
   "Cancelled · access until …".

To test the lock without waiting 7 days, set the test owner's trial end date
in the past in the SQL editor:
`UPDATE billing_accounts SET trial_ends_at = now() - interval '1 minute' WHERE owner_id = '<their auth user id>';`

### 9. Go live
Repeat steps 2, 3, 4, 6 and 7 in live mode. Live prices, key and webhook secret
are all different values from test mode.

## Moving an existing customer onto Stripe
Existing venues have no row in `billing_accounts`, which is what makes them
"billed directly". To move one across, add a row for the owner with a trial end
date. They then see the normal Plan & Billing screen and can add a card
themselves:

```sql
INSERT INTO billing_accounts (owner_id, trial_ends_at)
SELECT owner_id, now() + interval '14 days' FROM venues WHERE slug = '<their-slug>';
```

Tell them first: once the date passes without a card, their venue is paused.

## Known gaps
- **The pause is enforced in the app, not the database.** Someone technical
  could get past it with the developer tools. The staff limit *is* enforced in
  the database.
- **No emails.** Stripe's own customer emails can cover receipts and failed
  payments: Settings → Customer emails. The app sends nothing about the trial
  ending.
- **Additional venues on Starter.** Starter only allows one venue, which
  matches the existing "Multi-venue requires a Pro plan" rule. If someone
  downgrades from Pro with several venues, each venue is billed at £10.
