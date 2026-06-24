import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { PLANS } from '../../lib/constants'
import { PRO_PRICE, STARTER_PRICE, EXTRA_VENUE_PRICE } from '../../lib/pricing'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

function PlanBadge({ plan }) {
  const isPro = plan === PLANS.PRO
  return (
    <span className={`inline-flex items-center gap-[5px] py-1 px-[10px] rounded-full font-mono text-[11px] font-bold tracking-[0.05em] uppercase ${isPro ? 'bg-brand/8 text-brand' : 'bg-charcoal/6 text-charcoal/50'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {isPro ? 'Pro' : 'Starter'}
    </span>
  )
}

export default function BillingSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug, venuePlan } = useVenue()

  const vp = (path) => `/v/${venueSlug}${path}`
  const isPro = venuePlan === PLANS.PRO

  const features = {
    [PLANS.STARTER]: ['Compliance checks (all 14)', 'Staff & attendance', 'Daily action schedule', 'Up to 10 staff'],
    [PLANS.PRO]:     ['Everything in Starter', 'Rota & timesheets', 'Training tracker', 'Time-off requests', 'Custom roles & duties', 'Unlimited staff', 'Priority support'],
  }

  return (
    <div className="min-h-screen bg-surface">
      <SettingsSubHeader title="Plan & Billing" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="px-4 pt-4 pb-24 max-w-[480px] mx-auto">

        <div className="bg-brand rounded-[14px] p-[18px] pb-4 mb-[14px] text-white">
          <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-white/55 font-semibold">Current plan</div>
          <div className="flex items-baseline gap-[10px] mt-2">
            <span className="text-[28px] font-bold tracking-[-0.02em]">{isPro ? 'Pro' : 'Starter'}</span>
            <span className="text-[13px] text-white/60">{isPro ? `${PRO_PRICE}/mo` : `${STARTER_PRICE}/mo`}</span>
          </div>
          <div className="mt-[14px] flex flex-col gap-1.5">
            {(features[venuePlan] ?? features[PLANS.STARTER]).map(f => (
              <div key={f} className="flex items-center gap-2 text-[13px] text-white/85">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </div>
            ))}
          </div>
        </div>

        {!isPro && (
          <div className="bg-warning/10 border border-warning/20 rounded-[14px] px-4 py-[14px] mb-[14px]">
            <div className="text-sm font-semibold text-warning mb-1">Upgrade to Pro</div>
            <div className="text-[13px] text-charcoal/50 leading-[1.5] mb-3">
              Unlock the rota, timesheets, training tracker, time-off and more for {PRO_PRICE}/mo.
            </div>
            <a
              href="mailto:hello@pelikn.com?subject=Upgrade to Pro"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] bg-warning text-white no-underline text-[13px] font-semibold"
            >
              Request upgrade →
            </a>
          </div>
        )}

        <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] px-4 py-[14px]">
          <div className="font-mono text-[11px] text-charcoal/50 tracking-[0.06em] uppercase font-semibold mb-2">Add another venue</div>
          <div className="text-[13px] text-charcoal/50 leading-[1.5]">
            Each additional venue is {EXTRA_VENUE_PRICE}/mo on your current plan.
          </div>
          <a
            href="mailto:hello@pelikn.com?subject=Add another venue"
            className="inline-flex items-center gap-1.5 mt-3 h-[34px] px-[14px] rounded-lg bg-charcoal/6 text-charcoal/50 no-underline text-[13px] font-medium"
          >
            Contact us →
          </a>
        </div>

        <div className="font-mono text-[11px] text-charcoal/30 text-center mt-5 leading-[1.5]">
          To cancel or modify your subscription, email{' '}
          <a href="mailto:hello@pelikn.com" className="text-brand">hello@pelikn.com</a>
        </div>

      </div>
    </div>
  )
}
