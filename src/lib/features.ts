/**
 * Optional extras: side features that are OFF unless a venue switches them on
 * (Settings → Features → Optional extras). Agreed with Darragh, 8 Oct 2026.
 *
 * They're stored in the same app_settings 'features' JSON as the core module
 * switches, as an `extras` array. Migration 143 filled it in for every venue
 * that already had records, so nothing a venue used disappeared. Switching an
 * extra off never deletes anything — it hides the menu entries and sends its
 * pages back to the dashboard.
 *
 * Which plan an extra needs still comes from lib/plans.ts: `proGate` is the
 * Pro gate key, so a Pro extra on Starter shows the upgrade screen, not "off".
 */
import { isProFeature } from './plans'

export interface ExtraFeature {
  id: string
  label: string
  description: string
  /** Route under /v/:slug that belongs to this extra (plus anything below it). */
  path: string
  /** Pro gate key in lib/plans.ts, when the extra is Pro-only. */
  proGate?: string
}

export const EXTRA_FEATURES: ExtraFeature[] = [
  { id: 'fitness',               label: 'Fitness to Work',       path: '/fitness',               description: 'Daily staff fitness-to-work declarations' },
  { id: 'recall',                label: 'Recall & Withdrawal',   path: '/recall',                description: 'Recall procedure and product recall log' },
  { id: 'complaints',            label: 'Complaints',            path: '/complaints',            description: 'Customer food safety complaint log' },
  { id: 'haccp',                 label: 'HACCP Plan Builder',    path: '/haccp',                 description: 'Step-by-step HACCP plan wizard', proGate: 'haccp' },
  { id: 'eho_mock',              label: 'Mock Inspection',       path: '/eho-mock',              description: 'Self-audit checklist in the style of an EHO visit', proGate: 'eho-mock' },
  { id: 'equipment_maintenance', label: 'Equipment Maintenance', path: '/equipment-maintenance', description: 'Kitchen equipment servicing and repair logs' },
  { id: 'date_labelling',        label: 'Date Labelling',        path: '/date-labelling',        description: 'Opened and use-by date tracking' },
  { id: 'tips',                  label: 'Tips',                  path: '/tips',                  description: 'Share out tips across your team', proGate: 'tips' },
  { id: 'noticeboard',           label: 'Noticeboard',           path: '/noticeboard',           description: 'Team announcements', proGate: 'noticeboard' },
  { id: 'waste',                 label: 'Waste',                 path: '/waste',                 description: 'Food waste logging', proGate: 'waste' },
  { id: 'orders',                label: 'Supplier Orders',       path: '/orders',                description: 'Place and track supplier orders', proGate: 'orders' },
]

export const EXTRA_FEATURE_IDS = EXTRA_FEATURES.map(f => f.id)

export function isExtraFeature(id: string): boolean {
  return EXTRA_FEATURE_IDS.includes(id)
}

export function getExtraFeature(id: string): ExtraFeature | undefined {
  return EXTRA_FEATURES.find(f => f.id === id)
}

/** The Pro gate key a feature id is checked against (extras can use a route key). */
export function planGateFor(id: string): string {
  return getExtraFeature(id)?.proGate ?? id
}

/** True when the feature id needs Pro (core module or extra). */
export function featureNeedsPro(id: string): boolean {
  return isProFeature(planGateFor(id))
}

export interface FeatureConfig {
  mode: 'all' | 'custom'
  enabled: string[]
  /** Optional extras switched on. Missing = none (a brand-new venue). */
  extras?: string[]
}

/**
 * Has the venue switched this feature on? Ignores the plan — callers check
 * the plan separately so a Pro feature on Starter can show an upsell.
 *  • extras: on only when listed in `extras`
 *  • core modules: 'all' mode = on; 'custom' mode = on when listed
 */
export function isSwitchedOn(config: FeatureConfig | null | undefined, id: string): boolean {
  if (isExtraFeature(id)) return config?.extras?.includes(id) ?? false
  if (!config || config.mode === 'all') return true
  return config.enabled?.includes(id) ?? true
}

/** Which extra (if any) owns this in-venue path, e.g. '/recall' or '/haccp/step-2'. */
export function extraForPath(venuePath: string): ExtraFeature | undefined {
  return EXTRA_FEATURES.find(f => venuePath === f.path || venuePath.startsWith(f.path + '/'))
}

/** Turn one extra on or off, keeping everything else in the config. */
export function withExtra(config: FeatureConfig, id: string, on: boolean): FeatureConfig {
  const current = config.extras ?? []
  const extras = on
    ? (current.includes(id) ? current : [...current, id])
    : current.filter(x => x !== id)
  return { ...config, extras }
}

/**
 * Checks hub / worklist tile id → the feature switch that owns it. Tiles not
 * listed (documents, incidents) aren't switchable here; incidents is Pro-gated
 * by its page.
 */
export const CHECK_TILE_FEATURE: Record<string, string> = {
  fitness:   'fitness',
  openclose: 'opening_closing',
  fridge:    'fridge',
  cooking:   'cooking_temps',
  hot:       'hot_holding',
  cooling:   'cooling_logs',
  delivery:  'deliveries',
  probe:     'probe',
  allergen:  'allergens',
  pest:      'pest_control',
  cleaning:  'cleaning',
  haccp:     'haccp',
}

/** Is this Checks tile's feature visible? `isEnabled` comes from useVenueFeatures. */
export function checkTileEnabled(tileId: string, isEnabled: (featureId: string) => boolean): boolean {
  const feature = CHECK_TILE_FEATURE[tileId]
  return !feature || isEnabled(feature)
}
