import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { PLANS } from '../lib/constants'

const FEATURES_UPDATED_EVENT = 'pelikn:features-updated'

interface FeatureItem {
  id: string
  label: string
  description: string
}

interface FeatureGroup {
  id: string
  label: string
  description: string
  features: FeatureItem[]
}

/* ── Feature catalogue ───────────────────────────────────────────────────────
   Each feature has an id that maps directly to nav/route identifiers.
   FEATURE_GROUPS is used by the Settings UI to render the config panel.
   ─────────────────────────────────────────────────────────────────────────── */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'temperature',
    label: 'Temperature Control',
    description: 'Temperature monitoring and logging',
    features: [
      { id: 'fridge',        label: 'Fridge Temps',    description: 'Twice-daily fridge temperature checks' },
      { id: 'cooking_temps', label: 'Cooking Temps',   description: 'Cooking and reheating temperature logs (≥75°C)' },
      { id: 'hot_holding',   label: 'Hot Holding',     description: 'Twice-daily hot holding checks (≥63°C)' },
      { id: 'cooling_logs',  label: 'Cooling Logs',    description: 'Food cooling records (target ≤8°C)' },
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
      { id: 'waste',                 label: 'Waste',                description: 'Food waste logging' },
      { id: 'orders',               label: 'Supplier Orders',      description: 'Supplier order management' },
      { id: 'date_labelling',       label: 'Date Labelling',       description: 'Food item opened/use-by date tracking' },
      { id: 'equipment_maintenance', label: 'Equipment Maintenance', description: 'Kitchen equipment servicing and calibration logs' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Rota, training and time management',
    features: [
      { id: 'rota',      label: 'Rota',              description: 'Weekly staff scheduling and shift swaps' },
      { id: 'timesheet', label: 'Timesheets',        description: 'Hours and timesheet reporting' },
      { id: 'training',  label: 'Training',          description: 'Staff training and certificate records' },
      { id: 'time_off',  label: 'Time Off',          description: 'Staff time-off requests' },
      { id: 'tips',      label: 'Tip Distribution',  description: 'Distribute and track tips across your team' },
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
  'date_labelling', 'equipment_maintenance',                   // EHO compliance
]

export const PRO_ONLY_FEATURE_IDS = [
  'rota', 'timesheet', 'training', 'time_off', 'tips',         // team
  'waste', 'orders',                                           // advanced ops
]

// Routes/pages that are Pro-only but aren't in the feature-toggle system
export const PRO_ONLY_ROUTES = new Set([
  'rota', 'timesheet', 'time-off', 'training', 'waste', 'orders',
  'haccp', 'eho-mock', 'clock-in', 'noticeboard', 'tips',
])

interface FeatureConfig {
  mode: 'all' | 'custom'
  enabled: string[]
}

const DEFAULT_CONFIG: FeatureConfig = { mode: 'all', enabled: ALL_FEATURE_IDS }

async function fetchFeatures(venueId: string): Promise<FeatureConfig> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('venue_id', venueId)
    .eq('key', 'features')
    .single()

  if (data?.value) {
    try {
      return JSON.parse(data.value) as FeatureConfig
    } catch { /* ignore bad JSON, keep defaults */ }
  }
  return DEFAULT_CONFIG
}

export function useVenueFeatures() {
  const { venueId, venuePlan } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['venue-features', venueId]

  const { data: config, isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchFeatures(venueId),
    enabled: !!venueId,
    placeholderData: DEFAULT_CONFIG,
    staleTime: 60_000,
  })

  // Listen for saves from other hook instances (e.g. SettingsPage → AppShell)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ venueId: string }>).detail
      if (detail?.venueId === venueId) {
        refetch()
      }
    }
    window.addEventListener(FEATURES_UPDATED_EVENT, handler)
    return () => window.removeEventListener(FEATURES_UPDATED_EVENT, handler)
  }, [venueId, refetch])

  const save = useCallback(async (newConfig: FeatureConfig) => {
    if (!venueId) return
    // Optimistically update cache
    queryClient.setQueryData(queryKey, newConfig)
    // Notify all other hook instances
    window.dispatchEvent(new CustomEvent(FEATURES_UPDATED_EVENT, { detail: { venueId } }))
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key: 'features', value: JSON.stringify(newConfig) })
  }, [venueId, queryClient, queryKey])

  /** True if the feature requires Pro and the venue is on Starter. */
  const isPlanLocked = useCallback((featureId: string): boolean => {
    if (venuePlan === PLANS.PRO) return false
    return PRO_ONLY_FEATURE_IDS.includes(featureId) || PRO_ONLY_ROUTES.has(featureId)
  }, [venuePlan])

  /** Returns true if the feature should be visible.
   *  Plan-locked features are hidden from nav (use isPlanLocked separately for upsell UI).
   *  In 'all' mode every non-locked feature is enabled.
   *  In 'custom' mode only features in the enabled array are shown. */
  const isEnabled = useCallback((featureId: string): boolean => {
    if (isPlanLocked(featureId)) return false
    const cfg = config ?? DEFAULT_CONFIG
    if (cfg.mode === 'all') return true
    return cfg.enabled?.includes(featureId) ?? true
  }, [config, isPlanLocked])

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return { config: config ?? DEFAULT_CONFIG, isEnabled, isPlanLocked, venuePlan, save, loading, reload }
}
