import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { useVenue } from '../../contexts/VenueContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/ui/Toast'
import useBilling from '../../hooks/useBilling'
import { PLANS } from '../../lib/constants'
import { STARTER_FEATURES, PLAN_DETAILS, PLAN_ORDER } from '../../lib/plans'
import { STARTER_STAFF_LIMIT } from '../../lib/billing'
import { EXTRA_VENUE_PRICE, planTotal } from '../../lib/pricing'
import { changePlan, openBillingPortal, setTrialPlan, startCheckout } from '../../lib/api/billing'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

const PLAN_NAME = { [PLANS.STARTER]: PLAN_DETAILS.starter.name, [PLANS.PRO]: PLAN_DETAILS.pro.name }
const fmtDate = (iso) => format(new Date(iso), 'd MMM yyyy')

function statusLine(access, billing) {
  switch (access.state) {
    case 'trial':
      return `Free trial · ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'} left, ends ${fmtDate(access.endsAt)}`
    case 'subscribed':
      if (billing?.subscription_status === 'trialing' && billing.trial_ends_at) return `Card added · first payment ${fmtDate(billing.trial_ends_at)}`
      if (billing?.cancel_at_period_end && billing.current_period_end) return `Cancelled · access until ${fmtDate(billing.current_period_end)}`
      return billing?.current_period_end ? `Renews ${fmtDate(billing.current_period_end)}` : 'Active'
    case 'past_due':
      return 'Payment overdue · please update your card'
    case 'locked':
      return access.reason === 'trial_ended' ? 'Free trial ended' : access.reason === 'cancelled' ? 'Subscription ended' : 'Payment failed'
    default:
      return null
  }
}

function PlanOption({ plan, selected, onSelect, price, sfx }) {
  const active = selected === plan
  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      aria-pressed={active}
      className={`flex-1 rounded-xl border-2 px-3 py-3 text-left transition-colors ${active ? 'border-brand bg-brand/5' : 'border-charcoal/10 dark:border-white/10 hover:border-charcoal/25 dark:hover:border-white/25'}`}
    >
      <div className="text-sm font-semibold text-charcoal dark:text-white">{PLAN_NAME[plan]}</div>
      <div className="text-[13px] text-charcoal/55 dark:text-white/45">£{price}{sfx}</div>
    </button>
  )
}

export default function BillingSettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const { venueId, venueSlug, venuePlan, refreshVenue } = useVenue()
  const { user, venues: ownedVenues } = useAuth()
  const { billing, access, loading, reload } = useBilling()

  const plan = billing?.plan ?? venuePlan
  const isPro = plan === PLANS.PRO
  const venueCount = billing?.venue_count ?? 1
  const managed = !!billing?.managed
  const canManage = !!user && ownedVenues.some(v => v.id === venueId)
  const hasLiveSub = access.state === 'subscribed' || access.state === 'past_due'

  const [choice, setChoice] = useState(plan)
  const [period, setPeriod] = useState('month')
  const [busy, setBusy] = useState(null) // which action is running
  useEffect(() => { setChoice(plan) }, [plan])

  const vp = (path) => `/v/${venueSlug}${path}`

  // Back from Stripe Checkout. The webhook usually lands within seconds, so
  // re-read billing every few seconds for a short while until it has.
  const checkoutResult = params.get('billing')
  const [pollUntil, setPollUntil] = useState(0)
  useEffect(() => {
    if (!checkoutResult) return
    if (checkoutResult === 'success') {
      toast("You're all set. Thanks for choosing Pelikn.")
      setPollUntil(Date.now() + 20_000)
    }
    const next = new URLSearchParams(params)
    next.delete('billing')
    setParams(next, { replace: true })
  }, [checkoutResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const subscribed = !!billing?.has_subscription
  useEffect(() => {
    if (!pollUntil || subscribed) return
    const timer = window.setInterval(() => {
      if (Date.now() > pollUntil) { window.clearInterval(timer); return }
      reload()
    }, 2500)
    return () => window.clearInterval(timer)
  }, [pollUntil, subscribed, reload])

  // The plan lives on the venue row, which VenueContext caches; once billing
  // reports a different plan (webhook landed, plan switched), re-read it so
  // Pro pages unlock without a reload.
  useEffect(() => {
    if (billing && billing.plan !== venuePlan) refreshVenue()
  }, [billing, venuePlan, refreshVenue])

  const run = async (name, fn) => {
    setBusy(name)
    try {
      await fn()
    } catch (err) {
      toast(err.message, 'error')
      setBusy(null)
    }
  }

  const handleCheckout = () => run('checkout', async () => {
    const { url } = await startCheckout(venueId, choice, period, location.pathname)
    window.location.href = url
  })

  const handleTrialSwitch = () => run('trial', async () => {
    const { error } = await setTrialPlan(venueId, choice)
    if (error) throw new Error(error.message)
    await reload()
    setBusy(null)
  })

  const handleChangePlan = () => run('change', async () => {
    const target = isPro ? PLANS.STARTER : PLANS.PRO
    if (target === PLANS.STARTER && (billing?.active_staff ?? 0) > STARTER_STAFF_LIMIT) {
      toast(`Starter includes up to ${STARTER_STAFF_LIMIT} staff. Your current team stays, but you won't be able to add anyone new.`)
    }
    await changePlan(venueId, target)
    toast(`You're now on ${PLAN_NAME[target]}.`)
    await reload()
    setBusy(null)
  })

  const handlePortal = () => run('portal', async () => {
    const { url } = await openBillingPortal(venueId, location.pathname)
    window.location.href = url
  })

  const features = PLAN_DETAILS[plan]?.features ?? STARTER_FEATURES
  const status = statusLine(access, billing)
  const sfx = period === 'year' ? '/yr' : '/mo'
  const currentPrice = planTotal(plan, billing?.billing_interval === 'year' ? 'year' : 'month', venueCount)
  const currentSfx = billing?.billing_interval === 'year' ? '/yr' : '/mo'

  const btnPrimary = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[10px] bg-brand text-cream text-[13px] font-semibold disabled:opacity-60'
  const btnSecondary = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[10px] bg-charcoal/6 dark:bg-white/8 text-charcoal/70 dark:text-white/60 text-[13px] font-medium disabled:opacity-60'

  return (
    <div>
      <SettingsSubHeader title="Plan & Billing" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="pt-4 pb-24 max-w-[480px] mx-auto">

        {/* Current plan */}
        <div className="bg-brand rounded-[14px] p-[18px] pb-4 mb-[14px] text-white">
          <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-white/55 font-semibold">Current plan</div>
          <div className="flex items-baseline gap-[10px] mt-2">
            <span className="text-[28px] font-bold tracking-[-0.02em]">{PLAN_NAME[plan] ?? 'Starter'}</span>
            <span className="text-[13px] text-white/60">£{currentPrice}{currentSfx}</span>
          </div>
          {status && <div className="text-[13px] text-white/80 mt-1">{status}</div>}
          {managed && !isPro && (
            <div className="text-[13px] text-white/80 mt-1">
              Staff: {billing.active_staff} of {STARTER_STAFF_LIMIT}
            </div>
          )}
          <div className="mt-[14px] flex flex-col gap-1.5">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2 text-[13px] text-white/85">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </div>
            ))}
          </div>
        </div>

        {loading ? null : !managed ? (
          /* Venues from before self-serve billing are invoiced by hand. */
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-4 py-[14px] text-[13px] text-charcoal/60 dark:text-white/50 leading-[1.5]">
            Your account is billed directly by Pelikn. To change plan, add a venue or cancel, email{' '}
            <a href="mailto:hello@get-pelikn.com?subject=Plan change" className="text-brand dark:text-accent font-medium">hello@get-pelikn.com</a>.
          </div>
        ) : !canManage ? (
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-4 py-[14px] text-[13px] text-charcoal/60 dark:text-white/50 leading-[1.5]">
            Only the venue owner can change the plan or payment details. Sign in with the owner&apos;s email and password to manage billing.
          </div>
        ) : hasLiveSub ? (
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-4 py-[14px]">
            {access.state === 'past_due' && (
              <p className="text-[13px] text-danger font-medium mb-3">
                Your last payment didn&apos;t go through. Stripe will try again, but updating your card now keeps things running.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              {access.state === 'past_due' ? (
                <>
                  <button type="button" onClick={handlePortal} disabled={!!busy} className={btnPrimary}>
                    {busy === 'portal' ? 'Opening…' : 'Update card'}
                  </button>
                  <button type="button" onClick={handleChangePlan} disabled={!!busy} className={btnSecondary}>
                    {busy === 'change' ? 'Switching…' : isPro ? 'Switch to Starter' : 'Upgrade to Pro'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleChangePlan} disabled={!!busy} className={btnPrimary}>
                    {busy === 'change' ? 'Switching…' : isPro ? 'Switch to Starter' : 'Upgrade to Pro'}
                  </button>
                  <button type="button" onClick={handlePortal} disabled={!!busy} className={btnSecondary}>
                    {busy === 'portal' ? 'Opening…' : 'Card, invoices & cancelling'}
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-charcoal/45 dark:text-white/35 mt-3 leading-[1.5]">
              Plan changes take effect straight away and are charged or credited pro rata on your next bill.
            </p>
          </div>
        ) : (
          /* Trial, or lapsed: pick a plan and add a card. */
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-4 py-[14px]">
            <div className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase font-semibold mb-3">
              {access.state === 'trial' ? 'Keep Pelikn after your trial' : 'Choose a plan'}
            </div>

            <div className="inline-flex bg-charcoal/5 dark:bg-white/8 rounded-lg p-0.5 mb-3" role="group" aria-label="Billing period">
              {[['month', 'Monthly'], ['year', 'Annual · 2 months free']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPeriod(val)}
                  aria-pressed={period === val}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${period === val ? 'bg-white dark:bg-paperDark text-charcoal dark:text-white shadow-sm' : 'text-charcoal/50 dark:text-white/45'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              {PLAN_ORDER.map(p => (
                <PlanOption key={p} plan={p} selected={choice} onSelect={setChoice} price={planTotal(p, period, venueCount)} sfx={sfx} />
              ))}
            </div>
            {venueCount > 1 && (
              <p className="text-xs text-charcoal/45 dark:text-white/35 mb-3">Prices cover all {venueCount} of your venues.</p>
            )}

            <div className="flex flex-col gap-2">
              <button type="button" onClick={handleCheckout} disabled={!!busy} className={btnPrimary}>
                {busy === 'checkout' ? 'Opening secure checkout…' : `Add card · ${PLAN_NAME[choice]} £${planTotal(choice, period, venueCount)}${sfx}`}
              </button>
              {access.state === 'trial' && choice !== plan && (
                <button type="button" onClick={handleTrialSwitch} disabled={!!busy} className={btnSecondary}>
                  {busy === 'trial' ? 'Switching…' : `Try ${PLAN_NAME[choice]} for the rest of your trial`}
                </button>
              )}
            </div>
            <p className="text-xs text-charcoal/45 dark:text-white/35 mt-3 leading-[1.5]">
              {access.state === 'trial'
                ? `You won't be charged until your trial ends on ${fmtDate(access.endsAt)}. Cancel any time.`
                : 'Payments are handled securely by Stripe. Cancel any time.'}
            </p>
          </div>
        )}

        {managed && (
          <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-4 py-[14px] mt-[14px]">
            <div className="font-mono text-[11px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase font-semibold mb-2">Add another venue</div>
            <div className="text-[13px] text-charcoal/55 dark:text-white/45 leading-[1.5]">
              {isPro
                ? `Each extra venue is ${EXTRA_VENUE_PRICE}/mo on Pro. Add one from Settings → My Venues and your bill updates automatically.`
                : 'Multiple venues come with Pro.'}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
