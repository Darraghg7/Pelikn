import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueFeatures, FEATURE_GROUPS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { PLANS } from '../../lib/constants'
import { PRO_PRICE } from '../../lib/pricing'
import { EXTRA_FEATURES, getExtraFeature } from '../../lib/features'

// Optional extras (off until switched on in Settings → Features) get their own group.
const EXTRAS_GROUP = { id: 'extras', label: 'Optional extras', description: '', features: EXTRA_FEATURES }

/**
 * Feature guide for Settings → Help & Support: every module grouped, with a
 * Pro badge on the ones Starter can't use and a link straight to each page.
 * Starter venues also get an upgrade card pointing at Plan & Billing.
 */

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
  fitness:         '💪',
  recall:          '↩️',
  complaints:      '💬',
  haccp:           '🗂️',
  eho_mock:        '🔍',
  equipment_maintenance: '🔧',
  date_labelling:  '🏷️',
  tips:            '💷',
  noticeboard:     '📌',
  rota:            '📅',
  timesheet:       '⏱️',
  training:        '🎓',
  time_off:        '🏖️',
}

const GROUP_LABELS = {
  temperature: 'Temperature Control',
  compliance: 'Compliance',
  operations:  'Operations',
  team:        'Team Management',
}

function FeatureRow({ feature, venueSlug, locked, first }) {
  const route = FEATURE_ROUTES[feature.id] ?? getExtraFeature(feature.id)?.path.slice(1)
  const icon  = FEATURE_ICONS[feature.id] ?? '✦'

  return (
    <div className={`flex items-start gap-3 px-[14px] py-3 ${first ? '' : 'border-t border-charcoal/6 dark:border-white/8'} ${locked ? 'opacity-60' : ''}`}>
      <span className="text-base shrink-0 mt-0.5 w-5 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-charcoal dark:text-white">{feature.label}</p>
          {locked && (
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.04em] bg-accent/10 text-accent px-1.5 py-0.5 rounded shrink-0">
              Pro
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">{feature.description}</p>
      </div>
      {!locked && route && (
        <Link
          to={`/v/${venueSlug}/${route}`}
          className="text-[12px] font-semibold text-brand/70 hover:text-brand dark:text-white/60 dark:hover:text-white transition-colors shrink-0 mt-0.5"
        >
          Go →
        </Link>
      )}
    </div>
  )
}

function FeatureGroup({ group, venueSlug, venuePlan, first }) {
  const [open, setOpen] = useState(false)
  const isStarter = venuePlan === PLANS.STARTER
  const proCount = group.features.filter(f => PRO_ONLY_FEATURE_IDS.includes(f.id)).length

  return (
    <div className={first ? '' : 'border-t border-charcoal/6 dark:border-white/8'}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full p-[14px] text-left flex items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2">
          <span className="text-[14.5px] font-medium text-charcoal dark:text-white leading-[1.3]">
            {GROUP_LABELS[group.id] ?? group.label}
          </span>
          {isStarter && proCount > 0 && (
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.04em] bg-accent/10 text-accent px-1.5 py-0.5 rounded">
              {proCount} Pro
            </span>
          )}
        </span>
        <span className={`transition-transform duration-200 shrink-0 ${open ? 'rotate-90' : ''}`}>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30 dark:text-white/30">
            <path d="M1 1l4 4-4 4"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className="border-t border-charcoal/6 dark:border-white/8 bg-charcoal/[0.015] dark:bg-white/[0.02]">
          {group.features.map((feature, i) => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              venueSlug={venueSlug}
              first={i === 0}
              locked={isStarter && PRO_ONLY_FEATURE_IDS.includes(feature.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FeatureGuide() {
  const { venueSlug } = useVenue()
  const { venuePlan } = useVenueFeatures()
  const isStarter = venuePlan === PLANS.STARTER

  return (
    <>
      <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[18px] pb-[7px] px-0.5">Feature guide</div>
      <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden">
        {[...FEATURE_GROUPS, EXTRAS_GROUP].map((group, i) => (
          <FeatureGroup key={group.id} group={group} venueSlug={venueSlug} venuePlan={venuePlan} first={i === 0} />
        ))}
      </div>

      {isStarter && (
        <div className="mt-3 bg-accent/5 border border-accent/20 rounded-[14px] px-4 py-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-charcoal dark:text-white">Unlock the full platform</p>
          <p className="text-xs text-charcoal/55 dark:text-white/45 leading-relaxed">
            Pro adds rota management, timesheets, staff training records, time-off requests, HACCP tools, and more — everything you need to run your team alongside your compliance.
          </p>
          <Link
            to={`/v/${venueSlug}/settings/billing`}
            className="mt-1 inline-flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors self-start"
          >
            Upgrade to Pro — {PRO_PRICE}/mo →
          </Link>
        </div>
      )}
    </>
  )
}
