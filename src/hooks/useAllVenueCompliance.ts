import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfDay, endOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import { getActivePeriods } from '../lib/temperatureChecks'
import { isSwitchedOn, featureNeedsPro, type FeatureConfig } from '../lib/features'
import { PLANS } from '../lib/constants'
import { TODAY_ITEM_REGISTRY } from '../pages/dashboard/todayItemRegistry'
import { isActionDueToday } from './useTodaySummary'

interface Venue {
  id: string
  slug: string
  name: string
  [key: string]: unknown
}

type Urgency = 'danger' | 'warn' | 'info'

export interface VenueAction {
  id: string
  label: string
  /** Path inside the venue, e.g. '/fridge'. */
  route: string
  urgency: Urgency
}

/** Worst first — the order venues are listed in. */
export type VenueStatus = 'urgent' | 'attention' | 'review' | 'clear' | 'closed' | 'error'
export const STATUS_ORDER: VenueStatus[] = ['urgent', 'attention', 'review', 'clear', 'closed', 'error']

export interface VenueSummary {
  overdueClean: number
  onShiftToday: number
  checksToday: number
  totalChecks: number
  uncheckedFridges: number
  totalFridges: number
  criticalActions: number
  pendingLeave: number
}

export interface VenueOverview {
  venue: Venue
  status: VenueStatus
  summary: VenueSummary | null
  actions: VenueAction[]
  /** Closure reason, or true for a weekly closed day; false when trading. */
  closed: string | boolean
  /** Which of the columns this venue actually uses (feature switched on). */
  uses: { checks: boolean; fridges: boolean; cleaning: boolean; critical: boolean; leave: boolean; rota: boolean }
}

export interface OverviewAggregate {
  total: number
  needYou: number
  clear: number
  closed: number
  onShift: number
  actions: number
}

// The group view raises the same alerts as each venue's own Needs you list —
// the dashboard's default Today items plus the temperature logs. Closing checks
// and duties are left out: both read as "not done" all day until the evening,
// which across a group would flag every venue every morning.
const GROUP_ITEM_IDS = [
  'critical_actions', 'cleaning_tasks', 'fridge_checks', 'opening_checks',
  'cooking_temps', 'hot_holding', 'pending_leave',
]

const SETTING_KEYS = ['features', 'action_schedules', 'closed_days']

function parse(value: string | null | undefined): unknown {
  try { return value ? JSON.parse(value) : null } catch { return null }
}

async function fetchVenueOverview(venue: Venue, plan: string): Promise<VenueOverview> {
  const now = new Date()
  const [snap, settings] = await Promise.all([
    supabase.rpc('get_dashboard_snapshot', {
      p_venue_id:       venue.id,
      p_date:           format(now, 'yyyy-MM-dd'),
      p_day_start:      startOfDay(now).toISOString(),
      p_day_end:        endOfDay(now).toISOString(),
      p_active_periods: getActivePeriods(now),
    }),
    supabase.from('app_settings').select('key, value').eq('venue_id', venue.id).in('key', SETTING_KEYS),
  ])
  if (snap.error) throw snap.error
  if (settings.error) throw settings.error

  const byKey = Object.fromEntries((settings.data ?? []).map(r => [r.key, parse(r.value)]))
  const features   = (byKey.features as FeatureConfig | null) ?? null
  const schedules  = (byKey.action_schedules as Record<string, { enabled: boolean; days: number[] }> | null) ?? {}
  const closedDays = Array.isArray(byKey.closed_days) ? (byKey.closed_days as number[]) : []

  // Same rule as useVenueFeatures().isEnabled. The plan belongs to the account
  // holder, so every venue in the group shares the current venue's plan.
  const isEnabled = (id: string) =>
    (plan === PLANS.PRO || !featureNeedsPro(id)) && isSwitchedOn(features, id)

  const d = snap.data ?? {}
  const due = (k: string) => isActionDueToday(k, schedules)
  const todayDow = (now.getDay() + 6) % 7
  const closed: string | boolean = closedDays.includes(todayDow) || d.isClosed ? (d.closureReason || true) : false

  // Gated the same way useTodaySummary gates the dashboard: a check that is
  // not due today reads as zero, and nothing is overdue on a closed day.
  const summary = {
    overdueClean:       !closed && due('cleaning_tasks') ? d.overdueClean ?? 0 : 0,
    onShiftToday:       d.onShiftToday ?? 0,
    checksToday:        d.checksToday ?? 0,
    totalChecks:        d.totalChecks ?? 0,
    uncheckedFridges:   due('fridge_checks') ? d.uncheckedFridges ?? 0 : 0,
    totalFridges:       due('fridge_checks') ? d.totalFridges ?? 0 : 0,
    criticalActions:    d.criticalActions ?? 0,
    pendingLeave:       d.pendingLeave ?? 0,
    cookingTempsToday:  due('cooking_temps') ? d.cookingTempsToday ?? 0 : 0,
    hotHoldingToday:    due('hot_holding') ? d.hotHoldingToday ?? 0 : 0,
  }

  const vp = (p: string) => p
  const actions: VenueAction[] = []
  for (const id of GROUP_ITEM_IDS) {
    const item = TODAY_ITEM_REGISTRY[id as keyof typeof TODAY_ITEM_REGISTRY] as {
      feature: string | null; scheduleKey: string | null; route: string
      action?: (s: typeof summary, vp: (p: string) => string, closed: string | boolean) => false | { label: string; urgency: Urgency }
    }
    if (item.feature && !isEnabled(item.feature)) continue
    if (item.scheduleKey && !due(item.scheduleKey)) continue
    // Temperature logs only count once the venue is trading for the day.
    if (closed && id !== 'critical_actions' && id !== 'pending_leave') continue
    const a = item.action?.(summary, vp, closed)
    if (a) actions.push({ id, label: a.label, route: item.route, urgency: a.urgency })
  }
  const urgencyRank: Record<Urgency, number> = { danger: 0, warn: 1, info: 2 }
  actions.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency])

  const status: VenueStatus =
    actions.some(a => a.urgency === 'danger') ? 'urgent'
      : actions.some(a => a.urgency === 'warn') ? 'attention'
        : actions.length ? 'review'
          : closed ? 'closed'
            : 'clear'

  return {
    venue, status, summary, actions, closed,
    uses: {
      checks:   isEnabled('opening_closing') && summary.totalChecks > 0,
      fridges:  isEnabled('fridge') && summary.totalFridges > 0,
      cleaning: isEnabled('cleaning'),
      critical: isEnabled('corrective'),
      leave:    isEnabled('time_off'),
      rota:     isEnabled('rota'),
    },
  }
}

const NO_USES = { checks: false, fridges: false, cleaning: false, critical: false, leave: false, rota: false }

async function fetchAll(venues: Venue[], plan: string, unreadableIds: string[] = []): Promise<VenueOverview[]> {
  const skip = new Set(unreadableIds)
  // One venue failing (a permissions gap, a timeout) must not blank the rest.
  const settled = await Promise.allSettled(venues.map(v => skip.has(v.id) ? Promise.reject(new Error('not readable from this sign-in')) : fetchVenueOverview(v, plan)))
  return venues.map((venue, i) => {
    const r = settled[i]
    if (r.status === 'fulfilled') return r.value
    return { venue, status: 'error', summary: null, actions: [], closed: false, uses: NO_USES }
  })
}

/**
 * Today's state of every venue in the group, for the Group Overview page.
 * Each venue's numbers come from get_dashboard_snapshot — the same call the
 * venue's own dashboard makes — and its alerts from the same Today item
 * registry, so the two never disagree.
 */
export function useAllVenueCompliance(venues: Venue[] | null | undefined, plan: string, unreadableIds: string[] = []): {
  results: VenueOverview[]
  aggregate: OverviewAggregate
  loading: boolean
} {
  const list = venues ?? []
  const venueIds = list.map(v => v.id).join(',')
  const unreadableKey = unreadableIds.join(',')

  const { data: results, isLoading: loading } = useQuery({
    queryKey: ['all-venue-overview', venueIds, plan, unreadableKey],
    queryFn: () => fetchAll(list, plan, unreadableKey ? unreadableKey.split(',') : []),
    enabled: list.length > 0,
    staleTime: 30_000,
    refetchInterval: 120_000,
  })

  const aggregate = useMemo((): OverviewAggregate => {
    const r = results ?? []
    return {
      total:   r.length,
      needYou: r.filter(v => v.status === 'urgent' || v.status === 'attention').length,
      clear:   r.filter(v => v.status === 'clear' || v.status === 'review').length,
      closed:  r.filter(v => v.status === 'closed').length,
      onShift: r.reduce((sum, v) => sum + (v.summary?.onShiftToday ?? 0), 0),
      actions: r.reduce((sum, v) => sum + v.actions.length, 0),
    }
  }, [results])

  return { results: results ?? [], aggregate, loading }
}
