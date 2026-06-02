import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { PLANS } from '../../lib/constants'
import { PRO_PRICE, STARTER_PRICE, EXTRA_VENUE_PRICE } from '../../lib/pricing'

const MC = {
  brand: '#13362a', brandTint: '#f0f7f4',
  good:  '#16a34a', goodBg: '#f0fdf4',
  warn:  '#d97706', warnBg: '#fffbeb',
  ink:   '#111827', ink3: '#6b7280', ink4: '#9ca3af',
  line:  '#e5e7eb', line2: '#f3f4f6',
  paper: '#ffffff',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

function PlanBadge({ plan }) {
  const isPro = plan === PLANS.PRO
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
      background: isPro ? MC.brandTint : MC.line2,
      color: isPro ? MC.brand : MC.ink3,
      fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />
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
    <div style={{ padding: '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>

      <button onClick={() => navigate(vp('/settings/hub'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: MC.brand, fontSize: 14, fontWeight: 500 }}>
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Plan & Billing</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Your current subscription</div>
      </div>

      {/* Current plan card */}
      <div style={{ background: MC.brand, borderRadius: 14, padding: '18px 18px 16px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Current plan</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{isPro ? 'Pro' : 'Starter'}</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{isPro ? `${PRO_PRICE}/mo` : `${STARTER_PRICE}/mo`}</span>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(features[venuePlan] ?? features[PLANS.STARTER]).map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade prompt if on Starter */}
      {!isPro && (
        <div style={{ background: MC.warnBg, border: `1px solid ${MC.warn}33`, borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: MC.warn, marginBottom: 4 }}>Upgrade to Pro</div>
          <div style={{ fontSize: 13, color: MC.ink3, lineHeight: 1.5, marginBottom: 12 }}>
            Unlock the rota, timesheets, training tracker, time-off and more for {PRO_PRICE}/mo.
          </div>
          <a
            href="mailto:hello@pelikn.com?subject=Upgrade to Pro"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 36, padding: '0 16px', borderRadius: 9,
              background: MC.warn, color: '#fff', textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Request upgrade →
          </a>
        </div>
      )}

      {/* Additional venues */}
      <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Add another venue</div>
        <div style={{ fontSize: 13, color: MC.ink3, lineHeight: 1.5 }}>
          Each additional venue is {EXTRA_VENUE_PRICE}/mo on your current plan.
        </div>
        <a
          href="mailto:hello@pelikn.com?subject=Add another venue"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            height: 34, padding: '0 14px', borderRadius: 8,
            background: MC.line2, color: MC.ink3, textDecoration: 'none',
            fontSize: 13, fontWeight: 500,
          }}
        >
          Contact us →
        </a>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink4, textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
        To cancel or modify your subscription, email{' '}
        <a href="mailto:hello@pelikn.com" style={{ color: MC.brand }}>hello@pelikn.com</a>
      </div>

    </div>
  )
}
