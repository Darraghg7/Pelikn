import React from 'react'
import SettingsSection from './SettingsSection'
import { PLANS } from '../../lib/constants'

const COMPLIANCE_NAV_ITEMS = [
  { key: 'opening-closing', label: 'Opening & Closing Checks', feature: 'opening_closing' },
  { key: 'fitness',         label: 'Fitness to Work',          feature: null },
  { key: 'fridge',          label: 'Fridge Temps',             feature: 'fridge' },
  { key: 'cooking-temps',   label: 'Cooking Temps',            feature: null },
  { key: 'hot-holding',     label: 'Hot Holding',              feature: null },
  { key: 'cooling-logs',    label: 'Cooling Logs',             feature: null },
  { key: 'deliveries',      label: 'Deliveries',               feature: 'deliveries' },
  { key: 'probe',           label: 'Probe Calibration',        feature: 'probe' },
  { key: 'allergens',       label: 'Allergens',                feature: 'allergens' },
  { key: 'cleaning',        label: 'Cleaning',                 feature: 'cleaning' },
  { key: 'corrective',      label: 'Corrective Actions',       feature: 'corrective' },
]

export default function NavOrderSection({ isEnabled, venuePlan, complianceNavOrder, saveComplianceNavOrder }) {
  const activeItems = COMPLIANCE_NAV_ITEMS.filter(i => i.feature === null || isEnabled(i.feature))

  const orderedItems = complianceNavOrder.length
    ? [...activeItems].sort((a, b) => {
        const ai = complianceNavOrder.indexOf(a.key)
        const bi = complianceNavOrder.indexOf(b.key)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    : activeItems

  const move = (index, direction) => {
    const next = [...orderedItems]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= next.length) return
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    saveComplianceNavOrder(next.map(i => i.key))
  }

  const subtitle = `${activeItems.length} item${activeItems.length !== 1 ? 's' : ''}`

  return (
    <SettingsSection title="Navigation Order" subtitle={subtitle} locked={venuePlan !== PLANS.PRO}>
      <p className="text-xs text-charcoal/40 mb-4">
        Reorder the items in the Checks navigation to suit your workflow.
      </p>
      <div className="flex flex-col gap-1.5">
        {orderedItems.map((item, i) => (
          <div key={item.key} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-charcoal/3 border border-charcoal/8">
            <span className="flex-1 text-sm font-medium text-charcoal">{item.label}</span>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-2 text-charcoal/30 hover:text-charcoal disabled:opacity-20 transition-colors"
                aria-label="Move up"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === orderedItems.length - 1}
                className="p-2 text-charcoal/30 hover:text-charcoal disabled:opacity-20 transition-colors"
                aria-label="Move down"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  )
}
