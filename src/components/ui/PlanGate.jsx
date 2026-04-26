/**
 * PlanGate — wraps a Pro-only page.
 * If the venue is on Starter, renders an upgrade prompt instead of the page.
 * If the venue is on Pro, renders children normally.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { STARTER_PRICE, PRO_PRICE } from '../../lib/pricing'
import { PLANS } from '../../lib/constants'

const FEATURE_LABELS = {
  rota:        'Rota & Shift Management',
  timesheet:   'Timesheets & Hour Tracking',
  'time-off':  'Time Off Requests',
  training:    'Staff Training Records',
  waste:       'Waste Logging',
  orders:      'Supplier Orders',
  haccp:       'HACCP Generator',
  'eho-mock':  'EHO Mock Inspection',
  staff:       'Staff Management',
  'clock-in':  'Clock In / Out',
  noticeboard: 'Noticeboard',
  'shift-swaps': 'Shift Swaps',
}

export default function PlanGate({ feature, children }) {
  const { venuePlan } = useVenue()

  if (venuePlan === PLANS.PRO) return children

  const label = FEATURE_LABELS[feature] ?? 'This feature'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c94f2a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      <span className="text-[10px] tracking-widest uppercase font-semibold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full mb-3">
        Pro Plan
      </span>

      <h2 className="text-xl font-bold text-charcoal mb-2">{label}</h2>
      <p className="text-sm text-charcoal/50 max-w-sm leading-relaxed mb-8">
        This feature is included in Pelikn Pro. Upgrade to unlock rota management,
        timesheets, training records, HACCP tools, and more.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <a
          href="mailto:hello@pelikn.app?subject=Upgrade to Pro"
          className="flex-1 bg-accent text-cream py-3 rounded-xl text-sm font-semibold text-center hover:bg-accent/90 transition-colors"
        >
          Upgrade to Pro — {PRO_PRICE}/mo
</a>
        <Link
          to="../dashboard"
          relative="path"
          className="flex-1 border border-charcoal/15 text-charcoal/60 py-3 rounded-xl text-sm font-medium text-center hover:bg-charcoal/5 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      <p className="text-[11px] text-charcoal/30 mt-5">
        Current plan: <strong className="text-brand">Starter</strong> · {STARTER_PRICE}/month
      </p>
    </div>
  )
}
