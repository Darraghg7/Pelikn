/**
 * Startup bundle — one request for the ~14 small lookups the dashboard makes
 * as it opens (get_app_bootstrap, migration 126).
 *
 * Why: on a cold open the database has been idle, and the first burst costs
 * more the more requests arrive at once (measured: 1 request ~1.0 s, 12
 * ~2.5 s, 20 ~3.4-8 s). Folding these into one call keeps the opening burst
 * to ~4 requests.
 *
 * How hooks use it: each hook's fetch function calls takeBootstrap() first.
 * Every hook that mounts during startup shares the same in-flight request.
 * If it resolves, the hook builds its result from the bundle; otherwise
 * (function not applied yet, error, wrong staff member, key not covered) it
 * runs its own query exactly as before.
 *
 * The bundle is a snapshot of one moment, so it is only ever used for a
 * hook's FIRST load, and only while it is fresh:
 *  - each consumer can take it once — a later refetch (e.g. after clocking
 *    in, which goes through an RPC that cacheBus can't see) always runs the
 *    real query;
 *  - it expires BOOTSTRAP_TTL_MS after it was requested;
 *  - any successful table write expires it immediately (cacheBus);
 *  - it is requested at most once per venue per page load — a hook that
 *    first mounts minutes later does not trigger a whole new bundle.
 */
import { format, startOfWeek, subDays } from 'date-fns'
import { supabase } from '../supabase'
import { onDataWrite } from '../cacheBus'
import { SESSION_ID_KEY } from '../constants'
import { londonToday } from '../time'

export const BOOTSTRAP_TTL_MS = 15_000

/**
 * app_settings keys the bundle fetches — the union of what useAppSettings,
 * useVenueFeatures and useVenueBranding read. takeBootstrapSettings() checks
 * coverage, so a key added to a hook but not here falls back to that hook's
 * own query rather than silently reading as unset.
 */
export const BOOTSTRAP_SETTING_KEYS = [
  'custom_roles', 'closed_days', 'break_duration_mins', 'cleanup_minutes', 'fridge_check_time',
  'open_time', 'close_time', 'day_hours', 'compliance_nav_order', 'action_schedules',
  'late_grace_mins', 'break_overrun_grace_mins', 'require_late_reason',
  'require_manager_approval_for_late', 'notify_manager_at_strike', 'disciplinary_at_strike',
  'counting_window_days', 'push_to_manager', 'notify_break_overrun', 'hidden_check_tiles',
  'hidden_team_tiles', 'max_staff_off_enabled', 'max_staff_off_count', 'enforce_closing_checklist',
  'cleaning_visible_to_all', 'features', 'venue_name', 'logo_url',
]

type ClockRow = { event_type: string; occurred_at: string }

export interface AppBootstrap {
  staff_id: string | null
  setting_keys: string[]
  settings: { key: string; value: string }[]
  widget_layout: { widget_id: string; position: number }[]
  today_items: { item_id: string; position: number }[]
  clock_last: ClockRow[]
  clock_session: ClockRow[]
  week_clock: ClockRow[]
  closing_shifts: { is_closing: boolean }[]
  my_role_ids: { role_id: string }[]
  my_swaps: { id: string; status: string; resolved_at: string }[]
  my_time_off: { id: string; status: string; start_date: string; end_date: string; reviewed_at: string }[]
  my_shifts_today: { id: string; shift_date: string; start_time: string; end_time: string }[]
  disciplinary: { id: string; offence_type: string; strike_number: number; occurred_at: string; staff: { name: string } | null }[]
  unsigned_training: number
  managers: { id: string; name: string; role: string; photo_url?: string | null }[]
}

interface Entry {
  venueId: string
  startedAt: number
  expired: boolean
  consumed: Set<string>
  promise: Promise<AppBootstrap | null>
}

let current: Entry | null = null
const requestedVenues = new Set<string>()
let unavailable = false // function not deployed — stop asking for this page load

// Any successful write makes the snapshot potentially wrong.
onDataWrite(() => { if (current) current.expired = true })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function signedInStaffId(): string | null {
  try {
    const id = localStorage.getItem(SESSION_ID_KEY)
    return id && UUID_RE.test(id) ? id : null
  } catch {
    return null
  }
}

function request(venueId: string): Promise<AppBootstrap | null> {
  const now = new Date()
  return Promise.resolve(
    supabase.rpc('get_app_bootstrap', {
      p_venue_id:           venueId,
      p_staff_id:           signedInStaffId(),
      p_setting_keys:       BOOTSTRAP_SETTING_KEYS,
      p_today:              londonToday(),
      p_week_start:         startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      p_updates_since:      format(subDays(now, 7), 'yyyy-MM-dd') + 'T00:00:00',
      p_disciplinary_since: new Date(now.getTime() - 7 * 86400000).toISOString(),
    }),
  ).then(({ data, error }) => {
    if (error) {
      // PGRST202 = function not found: 126 isn't applied. Don't keep asking.
      if ((error as { code?: string }).code === 'PGRST202') unavailable = true
      return null
    }
    return (data ?? null) as AppBootstrap | null
  }).catch(() => null)
}

/**
 * The startup bundle for `consumer`'s first load, or undefined when the hook
 * should run its own query instead. Pass `staffId` from any hook that reads
 * per-person slices: the bundle is only used if it was built for that person.
 */
export async function takeBootstrap(
  venueId: string | null | undefined,
  consumer: string,
  staffId?: string | null,
): Promise<AppBootstrap | undefined> {
  if (!venueId || unavailable) return undefined

  if (!current || current.venueId !== venueId) {
    if (requestedVenues.has(venueId)) return undefined // startup is over for this venue
    requestedVenues.add(venueId)
    current = { venueId, startedAt: Date.now(), expired: false, consumed: new Set(), promise: request(venueId) }
  }

  const entry = current
  if (entry.consumed.has(consumer)) return undefined
  entry.consumed.add(consumer)

  const data = await entry.promise
  if (!data || entry.expired || Date.now() - entry.startedAt > BOOTSTRAP_TTL_MS) return undefined
  if (staffId !== undefined && (!staffId || data.staff_id !== staffId)) return undefined
  return data
}

/**
 * The bundle's app_settings rows for `keys`, or undefined to fall back — also
 * when any of `keys` wasn't part of the bundle's request.
 */
export async function takeBootstrapSettings(
  venueId: string | null | undefined,
  consumer: string,
  keys: readonly string[],
): Promise<{ key: string; value: string }[] | undefined> {
  const data = await takeBootstrap(venueId, consumer)
  if (!data) return undefined
  const covered = new Set(data.setting_keys ?? [])
  if (!keys.every(k => covered.has(k))) return undefined
  const wanted = new Set(keys)
  return (data.settings ?? []).filter(r => wanted.has(r.key))
}

/** Test hook: forget everything, as if the page had just loaded. */
export function _resetBootstrapForTests(): void {
  current = null
  requestedVenues.clear()
  unavailable = false
}
