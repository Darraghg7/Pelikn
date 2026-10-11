import { format, subDays } from 'date-fns'
import { supabase } from '../supabase'
import { fetchStaffPayRates } from './staffRestricted'
import { EXPLAINED_EXCEEDANCE_REASONS } from '../constants'
import { computeComplianceScore, deriveComplianceIssues, COMPLIANCE_RANGE_DAYS, getScoreTier } from '../compliance'

// Everything the dashboard widgets read. Each function does one widget's
// queries and returns the numbers it shows; the widgets wrap them in
// useWidgetQuery (which adds caching, the offscreen gate and the retry state).
// They throw on any database error so a widget shows "retry" instead of a
// reassuring zero.

type Row = Record<string, any>

function isOutOfRange(l: Row): boolean {
  return !!l.fridge &&
    (l.temperature < l.fridge.min_temp || l.temperature > l.fridge.max_temp) &&
    !EXPLAINED_EXCEEDANCE_REASONS.includes(l.exceedance_reason) &&
    !l.is_resolved
}

/** Fridge widget: today's out-of-range readings and how many fridges were checked. */
export async function fetchFridgeAlertsWidget(venueId: string, today: string) {
  const [{ data: logs, error: logsError }, { data: fridges, error: fridgesError }] = await Promise.all([
    supabase
      .from('fridge_temperature_logs')
      .select('id, temperature, exceedance_reason, is_resolved, fridge:fridge_id(name, min_temp, max_temp)')
      .eq('venue_id', venueId)
      .gte('logged_at', today)
      .order('logged_at', { ascending: false }),
    supabase.from('fridges').select('id, name').eq('venue_id', venueId).eq('is_active', true),
  ])
  if (logsError || fridgesError) throw logsError ?? fridgesError

  const items: Row[] = logs ?? []
  const outOfRange = items.filter(isOutOfRange)
  const checkedFridgeIds = new Set(items.map(l => l.fridge?.name).filter(Boolean))

  return {
    total: items.length,
    alerts: outOfRange.length,
    fridgeCount: fridges?.length ?? 0,
    checkedCount: checkedFridgeIds.size,
    alertItems: outOfRange.slice(0, 4),
  }
}

/** Deliveries widget: today's deliveries (latest 5) and how many failed. */
export async function fetchTodaysDeliveriesWidget(venueId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { data: checks, error } = await supabase.from('delivery_checks')
    .select('id, supplier_name, overall_pass, checked_at')
    .eq('venue_id', venueId)
    .gte('checked_at', today.toISOString())
    .order('checked_at', { ascending: false })
    .limit(5)
  if (error) throw error
  const items: Row[] = checks ?? []
  const fails = items.filter(c => !c.overall_pass).length
  return { total: items.length, fails, items }
}

/** Probe widget: days since the last calibration and recent failures. */
export async function fetchProbeCalibrationWidget(venueId: string) {
  const { data: records, error } = await supabase.from('probe_calibrations')
    .select('id, probe_name, pass, calibrated_at')
    .eq('venue_id', venueId)
    .order('calibrated_at', { ascending: false })
    .limit(10)
  if (error) throw error
  const items: Row[] = records ?? []
  const last = items[0]
  const daysSince = last
    ? Math.floor((new Date().getTime() - new Date(last.calibrated_at).getTime()) / 86400000)
    : null
  const recentFails = items.filter(r => !r.pass).length
  return { daysSince, recentFails, lastDate: last ? format(new Date(last.calibrated_at), 'd MMM') : 'Never' }
}

/** Open corrective actions, with how many are critical or major. */
export async function fetchOpenActionsWidget(venueId: string) {
  const { data: actions, error } = await supabase.from('corrective_actions')
    .select('id, severity, status, title, reported_at')
    .eq('venue_id', venueId)
    .eq('status', 'open')
    .order('severity')
  if (error) throw error
  const items: Row[] = actions ?? []
  const critical = items.filter(a => a.severity === 'critical').length
  const major = items.filter(a => a.severity === 'major').length
  return { total: items.length, critical, major, items }
}

/** Training certificates that have expired or expire within 30 days. */
export async function fetchExpiringTrainingWidget(venueId: string) {
  const { data: certs, error } = await supabase.from('staff_training')
    .select('id, title, expiry_date, staff:staff_id(name)')
    .eq('venue_id', venueId)
    .not('expiry_date', 'is', null)
    .order('expiry_date')
  if (error) throw error
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 86400000)
  const items: Row[] = certs ?? []
  const expired = items.filter(c => new Date(c.expiry_date) < now)
  const expiring = items.filter(c => {
    const d = new Date(c.expiry_date)
    return d >= now && d <= thirtyDays
  })
  return { expired: expired.length, expiring: expiring.length, items: [...expired, ...expiring].slice(0, 4) }
}

/** Today's rota for the "on shift today" widget. */
export async function fetchStaffOnShiftWidget(venueId: string, today: string): Promise<Row[]> {
  const { data: rows, error } = await supabase.from('shifts')
    .select('id, start_time, end_time, role_label, staff_id, staff:staff_id(name, colour, photo_url)')
    .eq('venue_id', venueId)
    .eq('shift_date', today)
    .order('start_time')
  if (error) throw error
  return rows ?? []
}

/** This week's shifts plus each person's hourly rate; the widget adds up hours and cost. */
export async function fetchWeeklyLabourInputs(venueId: string, weekStart: string) {
  // hourly_rate is no longer readable from the staff table (117), so the
  // rates come from staff_pay_rates instead. A non-manager gets only their
  // own rate back, which means this widget shows them their own cost
  // rather than the venue's — it is registered as a manager widget.
  const [{ data: shifts, error }, rates] = await Promise.all([
    supabase
      .from('shifts')
      .select('start_time, end_time, staff_id, staff:staff_id(is_under_18)')
      .eq('venue_id', venueId)
      .eq('week_start', weekStart),
    fetchStaffPayRates(),
  ])
  if (error) throw error
  return { shifts: (shifts ?? []) as Row[], rates }
}

/** Pending shift swap requests (first 5). */
export async function fetchPendingSwapsWidget(venueId: string) {
  const { data: swaps, error } = await supabase.from('shift_swaps')
    .select('id, requester_name, target_staff_name, status')
    .eq('venue_id', venueId)
    .eq('status', 'pending')
    .limit(5)
  if (error) throw error
  return { items: (swaps ?? []) as Row[], count: swaps?.length ?? 0 }
}

/** Pending leave requests and swap requests for the notifications widget. */
export async function fetchPendingLeaveAndSwaps(venueId: string) {
  const [{ data: leave, error: leaveError }, { data: swaps, error: swapsError }] = await Promise.all([
    supabase
      .from('time_off_requests')
      .select('id, staff_id, start_date, end_date, leave_type, staff:staff_id(name)')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('shift_swaps')
      .select('id, requester_name, target_staff_name')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .limit(5),
  ])
  if (leaveError || swapsError) throw leaveError ?? swapsError
  return { leave: (leave ?? []) as Row[], swaps: (swaps ?? []) as Row[] }
}

/** The compliance score widget: 30 days of records boiled down to one score. */
export async function fetchComplianceScoreWidget(venueId: string) {
  // Same window as EHOAuditPage's default range — a 30-day widget beside a
  // 90-day page produced two different numbers even before the maths
  // differed. See COMPLIANCE_RANGE_DAYS.
  const since = subDays(new Date(), COMPLIANCE_RANGE_DAYS).toISOString()
  const [temps, deliveries, calibrations, actions, training] = await Promise.all([
    supabase.from('fridge_temperature_logs').select('id, temperature, exceedance_reason, is_resolved, fridge:fridge_id(min_temp, max_temp)').eq('venue_id', venueId).gte('logged_at', since),
    supabase.from('delivery_checks').select('id, overall_pass, is_resolved').eq('venue_id', venueId).gte('checked_at', since),
    supabase.from('probe_calibrations').select('id, pass, is_resolved').eq('venue_id', venueId).gte('calibrated_at', since),
    // Open actions count however old they are — see fetchAuditData
    supabase.from('corrective_actions').select('id, status, severity').eq('venue_id', venueId).or(`reported_at.gte."${since}",status.eq.open`),
    supabase.from('staff_training').select('id, expiry_date, is_resolved').eq('venue_id', venueId),
  ])
  // A failed read must not turn into a perfect score.
  const failed = [temps, deliveries, calibrations, actions, training].find(r => r.error)
  if (failed?.error) throw failed.error

  // Every metric below counts UNRESOLVED records only, so marking
  // something resolved moves the score back up.
  const t: Row[] = temps.data ?? []
  const tempFails = t.filter(isOutOfRange).length

  const d: Row[] = deliveries.data ?? []
  const c: Row[] = calibrations.data ?? []
  const a: Row[] = actions.data ?? []
  const tr: Row[] = training.data ?? []
  const now = new Date()

  const metrics = {
    tempTotal:     t.length,
    tempFails,
    tempPassRate:  t.length > 0 ? Math.round(((t.length - tempFails) / t.length) * 100) : 100,
    deliveryTotal: d.length,
    deliveryFails: d.filter(x => !x.overall_pass && !x.is_resolved).length,
    probeTotal:    c.length,
    probeFails:    c.filter(x => !x.pass && !x.is_resolved).length,
    caOpen:        a.filter(x => x.status === 'open').length,
    caCritical:    a.filter(x => x.status === 'open' && x.severity === 'critical').length,
    expiredCerts:  tr.filter(x => x.expiry_date && new Date(x.expiry_date) < now && !x.is_resolved).length,
  }

  const { score } = computeComplianceScore(metrics)
  const issueList = deriveComplianceIssues(metrics)

  return { score, issues: issueList.length, status: getScoreTier(score).status, issueList }
}
