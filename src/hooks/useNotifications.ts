import { useQuery } from '@tanstack/react-query'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { isCheckRequired } from '../lib/temperatureChecks'
import { cleaningStatus, isVenueClosedOn } from './useCleaningTasks'
import type { CleaningTask, CleaningCompletion } from '../lib/api/cleaning'

type NotificationSeverity = 'critical' | 'warning' | 'info'

export interface AppNotification {
  id: string
  type: string
  message: string
  link: string
  severity: NotificationSeverity
}

type StaffRef = { name: string } | null | undefined

/**
 * Everything the notification rules read, in one shape. Filled either by the
 * get_manager_notifications_data RPC (migration 125, one request) or by the
 * per-table fallback below (~20 requests) until that migration is applied.
 */
export interface NotificationData {
  break_duration_mins: string | null
  closed_days: string | null
  swaps_pending: number
  time_off_pending: number
  shifts_today: { staff_id: string; start_time: string; staff?: StaffRef }[]
  clock_ins_today: { staff_id: string; occurred_at: string; staff?: StaffRef }[]
  breaks_today: { staff_id: string; event_type: string; occurred_at: string; staff?: StaffRef }[]
  task_templates: { id: string; title: string }[]
  task_completions_yesterday: { task_template_id: string }[]
  shifts_30d: { staff_id: string; shift_date: string; start_time: string; staff?: StaffRef }[]
  clock_ins_30d: { staff_id: string; occurred_at: string }[]
  fridge_logs_today: { fridge_id: string; check_period?: string; temperature: number; exceedance_reason?: string | null; is_resolved?: boolean; fridge?: { name: string; min_temp: number; max_temp: number } | null }[]
  fridges: { id: string; name: string; check_days?: number[] | null; required_periods?: string[] | null }[]
  training: { title: string; expiry_date: string; staff?: StaffRef }[]
  cleaning_tasks: { id: string; title: string; frequency: string; created_at?: string }[]
  venue_closures: { start_date: string; end_date: string }[]
  /** Latest completion per task only. */
  cleaning_last: { cleaning_task_id: string; completed_at: string }[]
  actions_open: { title: string; severity: string }[]
  probe_last: { calibrated_at: string }[]
  clock_edit_pending: { staff?: { name?: string } | null }[]
  hour_edits: { staff_name?: string | null }[]
}

/**
 * Computes manager notifications scoped to a venue.
 */
export function useNotifications(isManager: boolean): {
  notifications: AppNotification[]
  count: number
  loading: boolean
} {
  const { venueId } = useVenue()

  // React Query caches the result (60s) and dedupes across every mount of the
  // notification bell, so navigating between pages doesn't re-fetch.
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', venueId],
    queryFn: () => load(venueId!),
    enabled: isManager && !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  const notifications = data ?? []
  return { notifications, count: notifications.length, loading: isLoading }
}

async function load(vid: string): Promise<AppNotification[]> {
  const now = new Date()
  const data = (await fetchViaRpc(vid, now)) ?? (await fetchViaQueries(vid, now))
  return buildNotifications(data, now)
}

// The date strings every query filters on. Kept identical between the RPC and
// the fallback so both select exactly the same rows.
function windows(now: Date) {
  const today     = format(now, 'yyyy-MM-dd')
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd')
  const since30d  = format(subDays(now, 30), 'yyyy-MM-dd')
  return {
    today,
    yesterday,
    since30d,
    trainingUntil: format(new Date(now.getTime() + 30 * 86400000), 'yyyy-MM-dd'),
    dayStart:      today + 'T00:00:00',
    dayEnd:        today + 'T23:59:59',
    since30dStart: since30d + 'T00:00:00',
    editsSince:    format(subDays(now, 7), 'yyyy-MM-dd') + 'T00:00:00',
  }
}

/**
 * Fast path: one request (migration 125). Returns null when the function
 * isn't there yet — or on any error — so the caller falls back to the
 * per-table queries rather than showing an empty bell.
 */
async function fetchViaRpc(vid: string, now: Date): Promise<NotificationData | null> {
  const w = windows(now)
  const { data, error } = await supabase.rpc('get_manager_notifications_data', {
    p_venue_id:        vid,
    p_today:           w.today,
    p_yesterday:       w.yesterday,
    p_since_30d:       w.since30d,
    p_training_until:  w.trainingUntil,
    p_day_start:       w.dayStart,
    p_day_end:         w.dayEnd,
    p_since_30d_start: w.since30dStart,
    p_edits_since:     w.editsSince,
  })
  if (error || !data) return null
  return data as NotificationData
}

/**
 * Fallback: the original per-table reads, all fired at once. The ones that
 * used to be chained (cleaning tasks → closures → completions, pending edit
 * requests → legacy log) run in parallel here — each result is only consulted
 * by buildNotifications when it's needed, so fetching it anyway is harmless.
 */
async function fetchViaQueries(vid: string, now: Date): Promise<NotificationData> {
  const w = windows(now)
  const [
    breakRow, closedDaysRow, swaps, timeOff, shiftsToday, clockInsToday, breaksToday,
    templates, completions, shifts30d, clockIns30d, fridgeLogs, fridges, training,
    cleaningTasks, closures, cleaningCompletions, actions, probe, editRequests, hourEdits,
  ] = await Promise.all([
    supabase.from('app_settings').select('value').eq('venue_id', vid).eq('key', 'break_duration_mins').limit(1).maybeSingle(),
    supabase.from('app_settings').select('value').eq('venue_id', vid).eq('key', 'closed_days').maybeSingle(),
    supabase.from('shift_swaps').select('id', { count: 'exact', head: true }).eq('venue_id', vid).eq('status', 'pending'),
    supabase.from('time_off_requests').select('id', { count: 'exact', head: true }).eq('venue_id', vid).eq('status', 'pending'),
    supabase.from('shifts').select('staff_id, start_time, staff:staff_id(name)').eq('venue_id', vid).eq('shift_date', w.today),
    supabase.from('clock_events').select('staff_id, occurred_at, staff:staff_id(name)').eq('venue_id', vid).eq('event_type', 'clock_in').gte('occurred_at', w.dayStart).lte('occurred_at', w.dayEnd),
    supabase.from('clock_events').select('staff_id, event_type, occurred_at, staff:staff_id(name)').eq('venue_id', vid).in('event_type', ['break_start', 'break_end']).gte('occurred_at', w.dayStart).lte('occurred_at', w.dayEnd).order('occurred_at', { ascending: true }),
    supabase.from('task_templates').select('id, title').eq('venue_id', vid).eq('is_active', true),
    supabase.from('task_completions').select('task_template_id').eq('venue_id', vid).eq('completion_date', w.yesterday),
    supabase.from('shifts').select('staff_id, shift_date, start_time, staff:staff_id(name)').eq('venue_id', vid).gte('shift_date', w.since30d).lte('shift_date', w.today),
    supabase.from('clock_events').select('staff_id, occurred_at').eq('venue_id', vid).eq('event_type', 'clock_in').gte('occurred_at', w.since30dStart),
    supabase.from('fridge_temperature_logs').select('id, fridge_id, check_period, temperature, exceedance_reason, is_resolved, fridge:fridge_id(name, min_temp, max_temp)').eq('venue_id', vid).gte('logged_at', w.dayStart),
    supabase.from('fridges').select('id, name, check_days, required_periods').eq('venue_id', vid).eq('is_active', true),
    supabase.from('staff_training').select('id, title, expiry_date, staff:staff_id(name)').eq('venue_id', vid).not('expiry_date', 'is', null).lte('expiry_date', w.trainingUntil).order('expiry_date'),
    supabase.from('cleaning_tasks').select('id, title, frequency, created_at').eq('venue_id', vid).eq('is_active', true),
    supabase.from('venue_closures').select('start_date, end_date').eq('venue_id', vid),
    supabase.from('cleaning_completions').select('cleaning_task_id, completed_at').eq('venue_id', vid).order('completed_at', { ascending: false }),
    supabase.from('corrective_actions').select('id, title, severity').eq('venue_id', vid).eq('status', 'open'),
    supabase.from('probe_calibrations').select('id, calibrated_at').eq('venue_id', vid).order('calibrated_at', { ascending: false }).limit(1),
    supabase.from('clock_edit_requests').select('id, staff:staff_id ( name )').eq('venue_id', vid).eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
    supabase.from('hour_edit_log').select('staff_name, shift_date, created_at').eq('venue_id', vid).gte('created_at', w.editsSince).order('created_at', { ascending: false }).limit(20),
  ])

  // Completions arrive newest first; the first one seen per task is its latest.
  const cleaningLast: NotificationData['cleaning_last'] = []
  const seen = new Set<string>()
  for (const c of (cleaningCompletions.data ?? []) as { cleaning_task_id: string; completed_at: string }[]) {
    if (seen.has(c.cleaning_task_id)) continue
    seen.add(c.cleaning_task_id)
    cleaningLast.push(c)
  }

  // PostgREST returns to-one staff joins as objects; the untyped client infers arrays.
  const rows = <T,>(r: { data: unknown }) => (r.data ?? []) as T[]
  return {
    break_duration_mins:        (breakRow.data?.value as string | undefined) ?? null,
    closed_days:                (closedDaysRow.data?.value as string | undefined) ?? null,
    swaps_pending:              swaps.count ?? 0,
    time_off_pending:           timeOff.count ?? 0,
    shifts_today:               rows(shiftsToday),
    clock_ins_today:            rows(clockInsToday),
    breaks_today:               rows(breaksToday),
    task_templates:             rows(templates),
    task_completions_yesterday: rows(completions),
    shifts_30d:                 rows(shifts30d),
    clock_ins_30d:              rows(clockIns30d),
    fridge_logs_today:          rows(fridgeLogs),
    fridges:                    rows(fridges),
    training:                   rows(training),
    cleaning_tasks:             rows(cleaningTasks),
    venue_closures:             rows(closures),
    cleaning_last:              cleaningLast,
    actions_open:               rows(actions),
    probe_last:                 rows(probe),
    clock_edit_pending:         rows(editRequests),
    hour_edits:                 rows(hourEdits),
  }
}

// ── Rules ────────────────────────────────────────────────────────────────────
// Pure: data in, notifications out. Same rules and wording as when each check
// fetched its own rows.

export function buildNotifications(d: NotificationData, now: Date = new Date()): AppNotification[] {
  const items: AppNotification[] = []
  const today = format(now, 'yyyy-MM-dd')
  const breakDurationMins = d.break_duration_mins ? JSON.parse(d.break_duration_mins) : 30

  checkSwapRequests(items, d)
  checkLateClockIns(items, d, today)
  checkLateBreakReturns(items, d, breakDurationMins, now)
  checkIncompleteTasks(items, d)
  checkRepeatOffenders(items, d)
  checkFridgeAlerts(items, d, now)
  checkExpiringTraining(items, d, now)
  checkOverdueCleaning(items, d, now)
  checkCriticalActions(items, d)
  checkProbeCalibration(items, d, now)
  checkTimeOffRequests(items, d)
  checkHourEdits(items, d)

  const sevOrder: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2))
  return items
}

function checkSwapRequests(items: AppNotification[], d: NotificationData): void {
  const count = d.swaps_pending
  if (count && count > 0) items.push({ id: 'swaps', type: 'swap_request', message: `${count} shift swap request${count > 1 ? 's' : ''} pending`, link: '/rota', severity: 'warning' })
}

function checkLateClockIns(items: AppNotification[], d: NotificationData, today: string): void {
  const shifts = d.shifts_today
  const clockIns = d.clock_ins_today
  if (!shifts?.length || !clockIns?.length) return
  const lateOnes: string[] = []
  for (const ci of clockIns) {
    const shift = shifts.find(s => s.staff_id === ci.staff_id)
    if (!shift) continue
    const shiftStart = new Date(today + 'T' + shift.start_time)
    const clockInTime = parseISO(ci.occurred_at)
    const clockInFloored  = new Date(Math.floor(clockInTime.getTime() / 60000) * 60000)
    const shiftStartFloor = new Date(Math.floor(shiftStart.getTime() / 60000) * 60000)
    if ((clockInFloored.getTime() - shiftStartFloor.getTime()) / 60000 >= 1) lateOnes.push(ci.staff?.name ?? 'Unknown')
  }
  if (lateOnes.length > 0) items.push({ id: 'late-today', type: 'late_clock_in', message: `Late clock-in today: ${lateOnes.join(', ')}`, link: '/timesheet', severity: 'warning' })
}

function checkLateBreakReturns(items: AppNotification[], d: NotificationData, breakDurationMins: number, now: Date): void {
  const events = d.breaks_today
  if (!events?.length) return

  const state: Record<string, { name: string; onBreakSince: Date | null }> = {}
  for (const ev of events) {
    if (!state[ev.staff_id]) state[ev.staff_id] = { name: ev.staff?.name ?? 'Unknown', onBreakSince: null }
    if (ev.event_type === 'break_start') state[ev.staff_id].onBreakSince = parseISO(ev.occurred_at)
    else state[ev.staff_id].onBreakSince = null
  }

  const overdue = Object.values(state).filter(
    s => s.onBreakSince && (now.getTime() - s.onBreakSince.getTime()) / 60000 > breakDurationMins
  )
  if (overdue.length > 0) {
    items.push({
      id: 'overdue-break',
      type: 'overdue_break',
      message: `On extended break (${breakDurationMins}+ min): ${overdue.map(s => s.name).join(', ')}`,
      link: '/timesheet',
      severity: 'warning',
    })
  }
}

function checkIncompleteTasks(items: AppNotification[], d: NotificationData): void {
  const templates = d.task_templates
  if (!templates?.length) return
  const completedIds = new Set((d.task_completions_yesterday ?? []).map(c => c.task_template_id))
  const missed = templates.filter(t => !completedIds.has(t.id))
  if (missed.length > 0) items.push({ id: 'incomplete-yesterday', type: 'incomplete_tasks', message: `${missed.length} task${missed.length > 1 ? 's' : ''} not completed yesterday`, link: '/tasks', severity: 'warning' })
}

function checkRepeatOffenders(items: AppNotification[], d: NotificationData): void {
  const shifts = d.shifts_30d
  const clockIns = d.clock_ins_30d
  if (!shifts?.length || !clockIns?.length) return
  const lateCounts: Record<string, number> = {}
  const staffNames: Record<string, string> = {}
  for (const shift of shifts) {
    const ci = clockIns.find(c => c.staff_id === shift.staff_id && c.occurred_at.startsWith(shift.shift_date))
    if (!ci) continue
    const shiftStart = new Date(shift.shift_date + 'T' + shift.start_time)
    const ciFloored    = new Date(Math.floor(parseISO(ci.occurred_at).getTime() / 60000) * 60000)
    const startFloored = new Date(Math.floor(shiftStart.getTime() / 60000) * 60000)
    if ((ciFloored.getTime() - startFloored.getTime()) / 60000 >= 1) {
      lateCounts[shift.staff_id] = (lateCounts[shift.staff_id] ?? 0) + 1
      staffNames[shift.staff_id] = shift.staff?.name ?? 'Unknown'
    }
  }
  const offenders = Object.entries(lateCounts).filter(([, c]) => c >= 3).map(([id, c]) => `${staffNames[id]} (${c}x)`)
  if (offenders.length > 0) items.push({ id: 'repeat-offenders', type: 'repeat_offender', message: `Repeat late clock-ins (30 days): ${offenders.join(', ')}`, link: '/timesheet', severity: 'warning' })
}

const EXPLAINED_REASONS = ['delivery', 'defrost', 'service_access']

function checkFridgeAlerts(items: AppNotification[], d: NotificationData, now: Date): void {
  const readings = d.fridge_logs_today ?? []
  const outOfRange = readings.filter(l =>
    l.fridge &&
    (l.temperature < l.fridge.min_temp || l.temperature > l.fridge.max_temp) &&
    !l.is_resolved &&
    !EXPLAINED_REASONS.includes(l.exceedance_reason ?? '')
  )
  if (outOfRange.length > 0) {
    const fridgeNames = [...new Set(outOfRange.map(l => l.fridge?.name).filter(Boolean))] as string[]
    items.push({ id: 'fridge-alerts', type: 'fridge_alert', message: `${outOfRange.length} temp reading${outOfRange.length > 1 ? 's' : ''} out of range: ${fridgeNames.join(', ')}`, link: '/fridge', severity: 'critical' })
  }
  const fridges = d.fridges
  if (fridges?.length && fridges.length > 0) {
    // Grouped by period, not just presence of any log — a fridge logged AM
    // only still needs its PM reading if PM is a required period.
    const loggedPeriodsByFridge = new Map<string, Set<string>>()
    for (const l of readings) {
      if (!l.fridge_id || !l.check_period) continue
      if (!loggedPeriodsByFridge.has(l.fridge_id)) loggedPeriodsByFridge.set(l.fridge_id, new Set())
      loggedPeriodsByFridge.get(l.fridge_id)!.add(l.check_period)
    }
    // "Unchecked" only counts a fridge on a day/period it's actually
    // required for — a fridge whose check_days skips today (e.g. matching
    // a venue's closed day) was previously flagged anyway, since this only
    // asked "does any log exist today" without consulting the fridge's own
    // schedule. Mirrors isCheckRequired() / the dashboard's fallback path.
    const unchecked = fridges.filter(f => {
      const logged = loggedPeriodsByFridge.get(f.id) ?? new Set()
      return ['am', 'pm'].some(period => isCheckRequired(f, now, period) && !logged.has(period))
    })
    if (unchecked.length > 0 && now.getHours() >= 10) {
      items.push({ id: 'fridge-unchecked', type: 'fridge_unchecked', message: `${unchecked.length} fridge${unchecked.length > 1 ? 's' : ''} not checked today: ${unchecked.map(f => f.name).join(', ')}`, link: '/fridge', severity: 'warning' })
    }
  }
}

function checkExpiringTraining(items: AppNotification[], d: NotificationData, now: Date): void {
  const thirtyDays = new Date(now.getTime() + 30 * 86400000)
  const records = d.training ?? []
  const expired = records.filter(c => new Date(c.expiry_date) < now)
  const expiring = records.filter(c => { const dt = new Date(c.expiry_date); return dt >= now && dt <= thirtyDays })
  if (expired.length > 0) items.push({ id: 'training-expired', type: 'training_expired', message: `${expired.length} training cert${expired.length > 1 ? 's' : ''} expired: ${expired.slice(0, 3).map(c => `${c.staff?.name} (${c.title})`).join(', ')}`, link: '/training', severity: 'critical' })
  if (expiring.length > 0) items.push({ id: 'training-expiring', type: 'training_expiring', message: `${expiring.length} cert${expiring.length > 1 ? 's' : ''} expiring within 30 days`, link: '/training', severity: 'warning' })
}

function checkOverdueCleaning(items: AppNotification[], d: NotificationData, now: Date): void {
  const tasks = d.cleaning_tasks
  if (!tasks?.length) return

  // Nobody's on site to clean on a closed day — same rule as the dashboard
  // tile and the /cleaning page (useCleaningTasks.ts). This used its own
  // from-scratch overdue math with no closure check at all, so it kept
  // nagging about tasks from whenever the venue was last open.
  const closedDays: number[] = d.closed_days ? JSON.parse(d.closed_days) : []
  if (isVenueClosedOn(now, closedDays, d.venue_closures ?? [])) return

  const overdue: string[] = []
  for (const t of tasks as unknown as CleaningTask[]) {
    const last = (d.cleaning_last as unknown as CleaningCompletion[]).find(c => c.cleaning_task_id === t.id) ?? null
    if (cleaningStatus(t, last, now) === 'overdue') overdue.push(t.title)
  }
  if (overdue.length > 0) items.push({ id: 'cleaning-overdue', type: 'cleaning_overdue', message: `${overdue.length} cleaning task${overdue.length > 1 ? 's' : ''} overdue: ${overdue.slice(0, 3).join(', ')}${overdue.length > 3 ? '...' : ''}`, link: '/cleaning', severity: overdue.length > 3 ? 'critical' : 'warning' })
}

function checkCriticalActions(items: AppNotification[], d: NotificationData): void {
  const records = d.actions_open ?? []
  const critical = records.filter(a => a.severity === 'critical')
  const major = records.filter(a => a.severity === 'major')
  if (critical.length > 0) items.push({ id: 'critical-actions', type: 'critical_action', message: `${critical.length} critical action${critical.length > 1 ? 's' : ''} open: ${critical.slice(0, 2).map(a => a.title).join(', ')}`, link: '/corrective', severity: 'critical' })
  if (major.length > 0) items.push({ id: 'major-actions', type: 'major_action', message: `${major.length} major action${major.length > 1 ? 's' : ''} open`, link: '/corrective', severity: 'warning' })
}

function checkProbeCalibration(items: AppNotification[], d: NotificationData, now: Date): void {
  const last = d.probe_last?.[0]
  if (!last) { items.push({ id: 'probe-never', type: 'probe_overdue', message: 'No probe calibrations on record -- calibrate your probes', link: '/probe', severity: 'warning' }); return }
  const daysSince = Math.floor((now.getTime() - new Date(last.calibrated_at).getTime()) / 86400000)
  if (daysSince > 30) items.push({ id: 'probe-overdue', type: 'probe_overdue', message: `Probe calibration overdue -- last done ${daysSince} days ago`, link: '/probe', severity: 'warning' })
}

function checkTimeOffRequests(items: AppNotification[], d: NotificationData): void {
  const count = d.time_off_pending
  if (count && count > 0) items.push({ id: 'time-off-pending', type: 'time_off_pending', message: `${count} time-off request${count > 1 ? 's' : ''} awaiting approval`, link: '/time-off', severity: 'warning' })
}

function checkHourEdits(items: AppNotification[], d: NotificationData): void {
  // Pending approval requests — highest priority (shown as warning, not just info)
  const pending = d.clock_edit_pending
  if (pending?.length) {
    const count = pending.length
    const names = [...new Set(pending.map((r) => r.staff?.name).filter(Boolean))] as string[]
    items.push({
      id: 'hour-edit-requests',
      type: 'hour_edit',
      message: `${count} hour edit request${count > 1 ? 's' : ''} awaiting approval: ${names.slice(0, 3).join(', ')}`,
      link: '/timesheet',
      severity: 'warning',
    })
    return // don't stack with the legacy log notification
  }

  // Legacy: log of direct edits (kept for backwards compatibility)
  const data = d.hour_edits
  if (!data?.length) return
  const count = data.length
  const names = [...new Set(data.map((r) => r.staff_name).filter(Boolean))] as string[]
  items.push({
    id: 'hour-edits',
    type: 'hour_edit',
    message: `${count} manual hour edit${count > 1 ? 's' : ''} in the last 7 days: ${names.slice(0, 3).join(', ')}`,
    link: '/timesheet',
    severity: 'info',
  })
}
