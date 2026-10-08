import { useCallback, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { PLANS } from '../lib/constants'
import { takeBootstrapSettings } from '../lib/api/bootstrap'
import {
  EXTRA_FEATURE_IDS, featureNeedsPro, isSwitchedOn, withExtra, type FeatureConfig,
} from '../lib/features'

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
   Side features (tips, waste, recall…) are "optional extras" instead — off
   until switched on — and live in lib/features.ts.
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
    description: 'Daily checklists, cleaning and corrective actions',
    features: [
      { id: 'opening_closing', label: 'Opening / Closing', description: 'Daily opening and closing checklists' },
      { id: 'cleaning',        label: 'Cleaning',          description: 'Cleaning schedules and completion records' },
      { id: 'corrective',      label: 'Corrective Actions', description: 'Issue tracking and corrective action log' },
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
    ],
  },
]

export const ALL_FEATURE_IDS = FEATURE_GROUPS.flatMap(g => g.features.map(f => f.id))

// ── Plan feature split ────────────────────────────────────────────────────────
// Which plan a feature belongs to is decided in lib/plans.ts (PRO_GATES), the
// same list the pricing copy is built from. These are derived views of it.
export const PRO_ONLY_FEATURE_IDS = [...ALL_FEATURE_IDS, ...EXTRA_FEATURE_IDS].filter(featureNeedsPro)
export const STARTER_FEATURE_IDS  = ALL_FEATURE_IDS.filter(id => !featureNeedsPro(id))

const DEFAULT_CONFIG: FeatureConfig = { mode: 'all', enabled: ALL_FEATURE_IDS }

type ConfigChanges = Partial<FeatureConfig> | ((saved: FeatureConfig) => Partial<FeatureConfig>)

let saveChain: Promise<void> = Promise.resolve()

async function fetchFeatures(venueId: string): Promise<FeatureConfig> {
  // First load comes from the startup bundle when it's available (126).
  const boot = await takeBootstrapSettings(venueId, 'features', ['features'])
  const { data } = boot
    ? { data: boot[0] ?? null }
    : await supabase
      .from('app_settings')
      .select('value')
      .eq('venue_id', venueId)
      .eq('key', 'features')
      // No row is normal (a venue on defaults) — .single() turned that into a
      // 406 error in the console on every page load.
      .maybeSingle()
      .then(res => {
        // Throw so a failed read isn't mistaken for "no extras switched on".
        if (res.error) throw res.error
        return res
      })

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

  const queryKey = useMemo(() => ['venue-features', venueId], [venueId])

  const { data: config, isLoading: loading, isPlaceholderData, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchFeatures(venueId!),
    enabled: !!venueId,
    placeholderData: DEFAULT_CONFIG,
    staleTime: 60_000,
  })
  // Settings couldn't be read: show everything rather than hide features a
  // venue uses (same fail-open rule as the core modules' default).
  const failedOpen = isError && isPlaceholderData
  /** The real settings have arrived (or failed) — safe to redirect on them. */
  const ready = !!venueId && (!isPlaceholderData || isError)

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

  /**
   * Save part of the config. `changes` is merged onto what's saved NOW, not the
   * cache: the cache may still be the placeholder, and callers only pass what
   * they change (onboarding and the All/Custom switch don't know about extras
   * and mustn't wipe them). Saves run one at a time so quick toggles don't
   * overwrite each other.
   */
  const save = useCallback((changes: ConfigChanges): Promise<void> => {
    if (!venueId) return Promise.resolve()
    const apply = (base: FeatureConfig): FeatureConfig =>
      ({ ...base, ...(typeof changes === 'function' ? changes(base) : changes) })

    // Show the change straight away when we already hold the real settings.
    const cached = queryClient.getQueryData<FeatureConfig>(queryKey)
    if (cached && !isPlaceholderData) queryClient.setQueryData(queryKey, apply(cached))

    saveChain = saveChain.then(async () => {
      const saved = await fetchFeatures(venueId).catch(() => null)
      if (!saved) { queryClient.invalidateQueries({ queryKey }); return }
      const newConfig = apply(saved)
      queryClient.setQueryData(queryKey, newConfig)
      const { error } = await supabase
        .from('app_settings')
        .upsert({ venue_id: venueId, key: 'features', value: JSON.stringify(newConfig) })
      if (error) queryClient.invalidateQueries({ queryKey })
      // Tell the other hook instances (AppShell, MobileNav…) once it's stored.
      window.dispatchEvent(new CustomEvent(FEATURES_UPDATED_EVENT, { detail: { venueId } }))
    }).catch(() => { queryClient.invalidateQueries({ queryKey }) })
    return saveChain
  }, [venueId, queryClient, queryKey, isPlaceholderData])

  /** True if the feature requires Pro and the venue is on Starter. */
  const isPlanLocked = useCallback((featureId: string): boolean => {
    if (venuePlan === PLANS.PRO) return false
    return featureNeedsPro(featureId)
  }, [venuePlan])

  /** True if the venue has switched the feature on (plan not considered). */
  const isSwitchedOnFor = useCallback((featureId: string): boolean => {
    if (failedOpen) return true
    return isSwitchedOn(config ?? DEFAULT_CONFIG, featureId)
  }, [config, failedOpen])

  /** Returns true if the feature should be visible.
   *  Plan-locked features are hidden from nav (use isPlanLocked separately for upsell UI).
   *  Optional extras show only when switched on; core modules follow all/custom mode. */
  const isEnabled = useCallback((featureId: string): boolean => {
    if (isPlanLocked(featureId)) return false
    return isSwitchedOnFor(featureId)
  }, [isPlanLocked, isSwitchedOnFor])

  /** Switch one optional extra on or off. */
  const setExtra = useCallback((featureId: string, on: boolean) =>
    save(saved => ({ extras: withExtra(saved, featureId, on).extras })),
  [save])

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return {
    config: config ?? DEFAULT_CONFIG,
    isEnabled, isSwitchedOn: isSwitchedOnFor, isPlanLocked, venuePlan,
    save, setExtra, loading, ready, reload,
  }
}
