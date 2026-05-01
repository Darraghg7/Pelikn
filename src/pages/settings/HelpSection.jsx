import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueFeatures, FEATURE_GROUPS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { PLANS } from '../../lib/constants'
import { PRO_PRICE } from '../../lib/pricing'
import SettingsSection from './SettingsSection'

// ── Feature → route slug ──────────────────────────────────────────────────────
const FEATURE_ROUTES = {
  fridge:          'fridge',
  cooking_temps:   'cooking-temps',
  hot_holding:     'hot-holding',
  cooling_logs:    'cooling-logs',
  deliveries:      'deliveries',
  probe:           'probe',
  allergens:       'allergens',
  pest_control:    'pest-control',
  opening_closing: 'opening-closing',
  cleaning:        'cleaning',
  corrective:      'corrective',
  waste:           'waste',
  orders:          'orders',
  rota:            'rota',
  timesheet:       'timesheet',
  training:        'training',
  time_off:        'time-off',
}

// ── Feature icons ─────────────────────────────────────────────────────────────
const FEATURE_ICONS = {
  fridge:          '🌡️',
  cooking_temps:   '🍳',
  hot_holding:     '♨️',
  cooling_logs:    '❄️',
  deliveries:      '📦',
  probe:           '🔬',
  allergens:       '⚠️',
  pest_control:    '🐭',
  opening_closing: '🔑',
  cleaning:        '🧹',
  corrective:      '📋',
  waste:           '🗑️',
  orders:          '🛒',
  rota:            '📅',
  timesheet:       '⏱️',
  training:        '🎓',
  time_off:        '🏖️',
}

const GROUP_LABELS = {
  temperature: 'Temperature Control',
  food_safety: 'Food Safety',
  operations:  'Operations',
  team:        'Team Management',
}

// ── FAQs ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How do I add a new staff member?',
    a: 'Go to Settings → Staff Members and tap "Add Staff". Give them a name and a 4-digit PIN. They can then log in from the venue login screen using that PIN.',
  },
  {
    q: 'How do I prepare for an EHO inspection?',
    a: 'Open the Audit section from the compliance menu. You\'ll see a live readiness score, any gaps in your records, and a one-tap button to export a PDF covering all your logs — exactly what an EHO officer will want to see.',
  },
  {
    q: 'What does the allergen QR code do?',
    a: 'When you add food items and tag their allergens in the Allergens section, Pelikn generates a QR code that customers can scan at their table. It shows a live allergen matrix for your full menu — no printing required.',
  },
  {
    q: 'How do I export a compliance report?',
    a: 'Go to the Audit section. Tap "Export PDF" to download a report covering temperature logs, cleaning records, delivery checks, and corrective actions for any date range you choose.',
  },
  {
    q: 'Can I manage multiple venues from one account?',
    a: 'Yes — on the Pro plan you can add additional venues at £15/month each. Open Settings → Venues to add a new location. You\'ll get a separate dashboard, staff list, and compliance records for each venue.',
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureRow({ feature, venueSlug, locked }) {
  const route = FEATURE_ROUTES[feature.id]
  const icon  = FEATURE_ICONS[feature.id] ?? '✦'

  return (
    <div className={`flex items-start gap-3 px-3 py-3 rounded-xl border transition-colors ${
      locked
        ? 'border-charcoal/6 bg-charcoal/[0.02] opacity-60'
        : 'border-charcoal/8 bg-white hover:border-charcoal/15'
    }`}>
      <span className="text-base shrink-0 mt-0.5 w-5 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-charcoal">{feature.label}</p>
          {locked && (
            <span className="text-[9px] tracking-widest uppercase font-bold bg-accent/10 text-accent px-1.5 py-0.5 rounded-full shrink-0">
              Pro
            </span>
          )}
        </div>
        <p className="text-xs text-charcoal/45 mt-0.5 leading-relaxed">{feature.description}</p>
      </div>
      {!locked && route && (
        <Link
          to={`/v/${venueSlug}/${route}`}
          className="text-[11px] font-semibold text-brand/60 hover:text-brand transition-colors shrink-0 mt-0.5"
        >
          Go →
        </Link>
      )}
    </div>
  )
}

function FaqRow({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-charcoal/8 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal/[0.02] transition-colors gap-3"
      >
        <p className="text-sm font-medium text-charcoal">{q}</p>
        <svg
          className={`w-4 h-4 text-charcoal/30 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-charcoal/6">
          <p className="text-sm text-charcoal/60 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

function FeatureGroup({ group, venueSlug, venuePlan }) {
  const [open, setOpen] = useState(false)
  const hasLockedFeatures = group.features.some(f => PRO_ONLY_FEATURE_IDS.includes(f.id))
  const proCount = group.features.filter(f => PRO_ONLY_FEATURE_IDS.includes(f.id)).length

  return (
    <div className="border border-charcoal/8 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-charcoal/[0.02] hover:bg-charcoal/[0.04] transition-colors gap-3"
      >
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/60">
            {GROUP_LABELS[group.id] ?? group.label}
          </p>
          {hasLockedFeatures && venuePlan === PLANS.STARTER && (
            <span className="text-[9px] tracking-widest uppercase font-bold bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
              {proCount} Pro
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-charcoal/30 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-charcoal/6 flex flex-col gap-2">
          {group.features.map(feature => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              venueSlug={venueSlug}
              locked={venuePlan === PLANS.STARTER && PRO_ONLY_FEATURE_IDS.includes(feature.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HelpSection() {
  const { venueSlug }          = useVenue()
  const { venuePlan }          = useVenueFeatures()

  const isStarter = venuePlan === PLANS.STARTER

  return (
    <SettingsSection
      title="Help & Features"
      subtitle="Feature guide · FAQ · Support"
    >
      <div className="flex flex-col gap-6">

        {/* ── Feature guide ──────────────────────────────────────────────── */}
        <div>
          <p className="text-[11px] tracking-widest uppercase font-bold text-charcoal/40 mb-3">
            Feature Guide
          </p>
          <div className="flex flex-col gap-2">
            {FEATURE_GROUPS.map(group => (
              <FeatureGroup
                key={group.id}
                group={group}
                venueSlug={venueSlug}
                venuePlan={venuePlan}
              />
            ))}
          </div>
        </div>

        {/* ── Pro upsell (Starter only) ───────────────────────────────────── */}
        {isStarter && (
          <div className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-charcoal">Unlock the full platform</p>
            <p className="text-xs text-charcoal/55 leading-relaxed">
              Pro adds rota management, timesheets, staff training records, time-off requests, HACCP tools, and more — everything you need to run your team alongside your compliance.
            </p>
            <a
              href={`mailto:hello@pelikn.app?subject=Upgrade to Pro`}
              className="mt-1 inline-flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors self-start"
            >
              Upgrade to Pro — {PRO_PRICE}/mo →
            </a>
          </div>
        )}

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[11px] tracking-widest uppercase font-bold text-charcoal/40 mb-3">
            Common Questions
          </p>
          <div className="flex flex-col gap-2">
            {FAQS.map((faq, i) => (
              <FaqRow key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* ── Support footer ──────────────────────────────────────────────── */}
        <div className="border-t border-charcoal/8 pt-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal mb-1">Still need help?</p>
            <p className="text-xs text-charcoal/45 mb-3">
              Drop us an email and we'll get back to you — usually same day.
            </p>
            <a
              href="mailto:hello@pelikn.app"
              className="inline-flex items-center gap-1.5 bg-charcoal text-cream text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-charcoal/85 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              hello@pelikn.app
            </a>
          </div>
          <p className="text-[11px] text-charcoal/25">
            {isStarter ? `Starter plan · ${PRO_PRICE}/mo to upgrade` : 'Pro plan'} · Pelikn
          </p>
        </div>

      </div>
    </SettingsSection>
  )
}
