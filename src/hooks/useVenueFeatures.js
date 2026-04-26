import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { PLANS } from '../lib/constants'

const FEATURES_UPDATED_EVENT = 'pelikn:features-updated'

/* ── Feature catalogue ───────────────────────────────────────────────────────
   Each feature has an id that maps directly to nav/route identifiers.
   FEATURE_GROUPS is used by the Settings UI to render the config panel.
   ─────────────────────────────────────────────────────────────────────────── */
export const FEATURE_GROUPS = [
  {
    id: 'temperature',
    label: 'Temperature Control',
    description: 'Temperature monitoring and logging',
    features: [
      { id: 'fridge',        label: 'Fridge Temps',    description: 'Twice-daily fridge temperature checks' },
      { id: 'cooking_temps', label: 'Cooking Temps',   description: 'Cooking and reheating temperature logs (≥75°C)' },
      { id: 'hot_holding',   label: 'Hot Holding',     description: 'Twice-daily hot holding checks (≥63°C)' },
      { id: 'cooling_logs',  label: 'Cooling Logs',    description: 'Food cooling records — target ≤8°C' },
    ],
  },
  {
    id: 'food_safety',
    label: 'Food Safety',
    description: 'Delivery checks, calibration and allergen records',
    features: [
      { id: 'deliveries',   label: 'Deliveries',       description: 'Delivery temperature and condition checks' },
      { id: 'probe',        label: 'Probe Calibration', description: 'Thermometer calibration records' },
      { id: 'allergens',    label: 'Allergens',        description: 'Allergen register and food item records' },
      { id: 'pest_control', label: 'Pest Control',     description: 'Pest inspections, sightings and treatment logs' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Daily checklists, cleaning and waste',
    features: [
      { id: 'opening_closing', label: 'Opening / Closing', description: 'Daily opening and closing checklists' },
      { id: 'cleaning',        label: 'Cleaning',          description: 'Cleaning schedules and completion records' },
      { id: 'corrective',      label: 'Corrective Actions', description: 'Issue tracking and corrective action log' },
      { id: 'waste',           label: 'Waste',             description: 'Food waste logging' },
      { id: 'orders',          label: 'Supplier Orders',   description: 'Supplier order management' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Rota, training and time management',
    features: [
      { id: 'rota',      label: 'Rota',        description: 'Weekly staff scheduling and shift swaps' },
      { id: 'timesheet', label: 'Timesheets',  description: 'Hours and timesheet reporting' },
      { id: 'training',  label: 'Training',    description: 'Staff training and certificate records' },
      { id: 'time_off',  label: 'Time Off',    description: 'Staff time-off requests' },
    ],
  },
]

export const ALL_FEATURE_IDS = FEATURE_GROUPS.flatMap(g => g.features.map(f => f.id))

// ── Plan feature split ────────────────────────────────────────────────────────
// Starter: core compliance — everything a venue needs to pass an EHO inspection
// Pro: team management + advanced ops on top of everything in Starter
export const STARTER_FEATURE_IDS = [
  'fridge', 'cooking_temps', 'hot_holding', 'cooling_logs',   // temperature
  'deliveries', 'probe', 'allergens', 'pest_control',          // food safety
  'opening_closing', 'cleaning', 'corrective',                 // daily ops
]

export const PRO_ONLY_FEATURE_IDS = [
  'rota', 'timesheet', 'training', 'time_off',                 // team
  'waste', 'orders',                                           // advanced ops
]

// Routes/pages that are Pro-only but aren't in the feature-toggle system
export const PRO_ONLY_ROUTES = new Set([
  'rota', 'timesheet', 'time-off', 'training', 'waste', 'orders',
  'haccp', 'eho-mock',
])

const DEFAULT_CONFIG = { mode: 'all', enabled: ALL_FEATURE_IDS }

// Module-level cache — avoids re-fetching on every navigation
const _cache = {}

export function useVenueFeatures() {
  const { venueId, venuePlan } = useVenue()

  const [config, setConfig] = useState(() => {
    if (venueId && _cache[venueId]) return _cache[venueId]
    return DEFAULT_CONFIG
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    // 60-second cache
    if (_cache[venueId + '_ts'] && Date.now() - _cache[venueId + '_ts'] < 60000) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('venue_id', venueId)
      .eq('key', 'features')
      .single()

    try {
      if (data?.value) {
        const parsed = JSON.parse(data.value)
        _cache[venueId] = parsed
        _cache[venueId + '_ts'] = Date.now()
        setConfig(parsed)
      }
    } catch { /* ignore bad JSON, keep defaults */ }
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  // Listen for saves from other hook instances (e.g. SettingsPage → AppShell)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.venueId === venueId && _cache[venueId]) {
        setConfig(_cache[venueId])
      }
    }
    window.addEventListener(FEATURES_UPDATED_EVENT, handler)
    return () => window.removeEventListener(FEATURES_UPDATED_EVENT, handler)
  }, [venueId])

  const save = useCallback(async (newConfig) => {
    if (!venueId) return
    setConfig(newConfig)
    // Update cache and notify all other hook instances
    _cache[venueId] = newConfig
    _cache[venueId + '_ts'] = Date.now()
    window.dispatchEvent(new CustomEvent(FEATURES_UPDATED_EVENT, { detail: { venueId } }))
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'features', value: JSON.stringify(newConfig) })
  }, [venueId])

  /** True if the feature requires Pro and the venue is on Starter. */
  const isPlanLocked = useCallback((featureId) => {
    if (venuePlan === PLANS.PRO) return false
    return PRO_ONLY_FEATURE_IDS.includes(featureId) || PRO_ONLY_ROUTES.has(featureId)
  }, [venuePlan])

  /** Returns true if the feature should be visible.
   *  Plan-locked features are hidden from nav (use isPlanLocked separately for upsell UI).
   *  In 'all' mode every non-locked feature is enabled.
   *  In 'custom' mode only features in the enabled array are shown. */
  const isEnabled = useCallback((featureId) => {
    if (isPlanLocked(featureId)) return false
    if (config.mode === 'all') return true
    return config.enabled?.includes(featureId) ?? true
  }, [config, isPlanLocked])

  return { config, isEnabled, isPlanLocked, venuePlan, save, loading, reload: load }
}
