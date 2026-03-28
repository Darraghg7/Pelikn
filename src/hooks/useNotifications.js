import { useState, useEffect } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

/**
 * Computes manager notifications scoped to a venue.
 */
export function useNotifications(isManager) {
  const { venueId } = useVenue()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (!isManager || !venueId) { setLoading(false); return }
    let cancelled = false
    load(venueId)
      .then(items  => { if (!cancelled) setNotifications(items) })
      .catch(()    => { if (!cancelled) setNotifications([]) })
      .finally(()  => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isManager, venueId])

  return { notifications, count: notifications.length, loading }
}

async function load(vid) {
  const items = []
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  await Promise.all([
    checkSwapRequests(items, vid),
    checkLateClockIns(items, today, vid),
    checkIncompleteTasks(items, yesterday, vid),
    checkRepeatOffenders(items, vid),
    checkFridgeAlerts(items, today, vid),
    checkExpiringTraining(items, vid),
    checkOverdueCleaning(items, vid),
    checkCriticalActions(items, vid),
    checkProbeCalibration(items, vid),
    checkTimeOffRequests(items, vid),
    checkHourEdits(items, vid),
  ])

  const sevOrder = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2))
  return items
}

async function checkSwapRequests(items, vid) {
  const { count } = await supabase.from('shift_swaps').select('id', { count: 'exact', head: true }).eq('venue_id', vid).eq('status', 'pending')
  if (count > 0) items.push({ id: 'swaps', type: 'swap_request', message: `${count} shift swap request${count > 1 ? 's' : ''} pending`, link: '/rota', severity: 'warning' })
}

async function checkLateClockIns(items, today, vid) {
  const [{ data: shifts }, { data: clockIns }] = await Promise.all([
    supabase.from('shifts').select('staff_id, start_time, staff:staff_id(name)').eq('venue_id', vid).eq('shift_date', today),
    supabase.from('clock_events').select('staff_id, occurred_at, staff:staff_id(name)').eq('venue_id', vid).eq('event_type', 'clock_in').gte('occurred_at', today + 'T00:00:00').lte('occurred_at', today + 'T23:59:59'),
  ])
  if (!shifts?.length || !clockIns?.length) return
  const lateOnes = []
  for (const ci of clockIns) {
    const shift = shifts.find(s => s.staff_id === ci.staff_id)
    if (!shift) continue
    const shiftStart = new Date(today + 'T' + shift.start_time)
    const clockInTime = parseISO(ci.occurred_at)
    if ((clockInTime - shiftStart) / 60000 > 2) lateOnes.push(ci.staff?.name ?? 'Unknown')
  }
  if (lateOnes.length > 0) items.push({ id: 'late-today', type: 'late_clock_in', message: `Late clock-in today: ${lateOnes.join(', ')}`, link: '/timesheet', severity: 'warning' })
}

async function checkIncompleteTasks(items, yesterday, vid) {
  const [{ data: templates }, { data: completions }] = await Promise.all([
    supabase.from('task_templates').select('id, title').eq('venue_id', vid).eq('is_active', true),
    supabase.from('task_completions').select('task_template_id').eq('venue_id', vid).eq('completion_date', yesterday),
  ])
  if (!templates?.length) return
  const completedIds = new Set((completions ?? []).map(c => c.task_template_id))
  const missed = templates.filter(t => !completedIds.has(t.id))
  if (missed.length > 0) items.push({ id: 'incomplete-yesterday', type: 'incomplete_tasks', message: `${missed.length} task${missed.length > 1 ? 's' : ''} not completed yesterday`, link: '/opening-closing', severity: 'warning' })
}

async function checkRepeatOffenders(items, vid) {
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')
  const [{ data: shifts }, { data: clockIns }] = await Promise.all([
    supabase.from('shifts').select('staff_id, shift_date, start_time, staff:staff_id(name)').eq('venue_id', vid).gte('shift_date', since).lte('shift_date', today),
    supabase.from('clock_events').select('staff_id, occurred_at').eq('venue_id', vid).eq('event_type', 'clock_in').gte('occurred_at', since + 'T00:00:00'),
  ])
  if (!shifts?.length || !clockIns?.length) return
  const lateCounts = {}, staffNames = {}
  for (const shift of shifts) {
    const ci = clockIns.find(c => c.staff_id === shift.staff_id && c.occurred_at.startsWith(shift.shift_date))
    if (!ci) continue
    const shiftStart = new Date(shift.shift_date + 'T' + shift.start_time)
    if ((parseISO(ci.occurred_at) - shiftStart) / 60000 > 2) {
      lateCounts[shift.staff_id] = (lateCounts[shift.staff_id] ?? 0) + 1
      staffNames[shift.staff_id] = shift.staff?.name ?? 'Unknown'
    }
  }
  const offenders = Object.entries(lateCounts).filter(([, c]) => c >= 3).map(([id, c]) => `${staffNames[id]} (${c}x)`)
  if (offenders.length > 0) items.push({ id: 'repeat-offenders', type: 'repeat_offender', message: `Repeat late clock-ins (30 days): ${offenders.join(', ')}`, link: '/timesheet', severity: 'warning' })
}

async function checkFridgeAlerts(items, today, vid) {
  const { data: logs } = await supabase.from('fridge_temperature_logs').select('id, temperature, fridge:fridge_id(name, min_temp, max_temp)').eq('venue_id', vid).gte('logged_at', today + 'T00:00:00')
  const readings = logs ?? []
  const outOfRange = readings.filter(l => l.fridge && (l.temperature < l.fridge.min_temp || l.temperature > l.fridge.max_temp))
  if (outOfRange.length > 0) {
    const fridgeNames = [...new Set(outOfRange.map(l => l.fridge?.name).filter(Boolean))]
    items.push({ id: 'fridge-alerts', type: 'fridge_alert', message: `${outOfRange.length} temp reading${outOfRange.length > 1 ? 's' : ''} out of range: ${fridgeNames.join(', ')}`, link: '/fridge', severity: 'critical' })
  }
  const { data: fridges } = await supabase.from('fridges').select('id, name').eq('venue_id', vid).eq('is_active', true)
  if (fridges?.length > 0) {
    const checkedIds = new Set(readings.map(l => l.fridge?.name).filter(Boolean))
    const unchecked = fridges.filter(f => !checkedIds.has(f.name))
    if (unchecked.length > 0 && new Date().getHours() >= 10) {
      items.push({ id: 'fridge-unchecked', type: 'fridge_unchecked', message: `${unchecked.length} fridge${unchecked.length > 1 ? 's' : ''} not checked today: ${unchecked.map(f => f.name).join(', ')}`, link: '/fridge', severity: 'warning' })
    }
  }
}

async function checkExpiringTraining(items, vid) {
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 86400000)
  const { data: certs } = await supabase.from('staff_training').select('id, title, expiry_date, staff:staff_id(name)').eq('venue_id', vid).not('expiry_date', 'is', null).lte('expiry_date', format(thirtyDays, 'yyyy-MM-dd')).order('expiry_date')
  const records = certs ?? []
  const expired = records.filter(c => new Date(c.expiry_date) < now)
  const expiring = records.filter(c => { const d = new Date(c.expiry_date); return d >= now && d <= thirtyDays })
  if (expired.length > 0) items.push({ id: 'training-expired', type: 'training_expired', message: `${expired.length} training cert${expired.length > 1 ? 's' : ''} expired: ${expired.slice(0, 3).map(c => `${c.staff?.name} (${c.title})`).join(', ')}`, link: '/training', severity: 'critical' })
  if (expiring.length > 0) items.push({ id: 'training-expiring', type: 'training_expiring', message: `${expiring.length} cert${expiring.length > 1 ? 's' : ''} expiring within 30 days`, link: '/training', severity: 'warning' })
}

async function checkOverdueCleaning(items, vid) {
  const { data: tasks } = await supabase.from('cleaning_tasks').select('id, title, frequency').eq('venue_id', vid).eq('is_active', true)
  if (!tasks?.length) return
  const { data: completions } = await supabase.from('cleaning_completions').select('cleaning_task_id, completed_at').eq('venue_id', vid).order('completed_at', { ascending: false })
  const freqDays = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }
  const now = new Date()
  const overdue = []
  for (const t of tasks) {
    const last = completions?.find(c => c.cleaning_task_id === t.id)
    if (!last) { overdue.push(t.title); continue }
    if ((now - new Date(last.completed_at)) / 86400000 > (freqDays[t.frequency] ?? 1)) overdue.push(t.title)
  }
  if (overdue.length > 0) items.push({ id: 'cleaning-overdue', type: 'cleaning_overdue', message: `${overdue.length} cleaning task${overdue.length > 1 ? 's' : ''} overdue: ${overdue.slice(0, 3).join(', ')}${overdue.length > 3 ? '...' : ''}`, link: '/cleaning', severity: overdue.length > 3 ? 'critical' : 'warning' })
}

async function checkCriticalActions(items, vid) {
  const { data: actions } = await supabase.from('corrective_actions').select('id, title, severity').eq('venue_id', vid).eq('status', 'open')
  const records = actions ?? []
  const critical = records.filter(a => a.severity === 'critical')
  const major = records.filter(a => a.severity === 'major')
  if (critical.length > 0) items.push({ id: 'critical-actions', type: 'critical_action', message: `${critical.length} critical action${critical.length > 1 ? 's' : ''} open: ${critical.slice(0, 2).map(a => a.title).join(', ')}`, link: '/corrective', severity: 'critical' })
  if (major.length > 0) items.push({ id: 'major-actions', type: 'major_action', message: `${major.length} major action${major.length > 1 ? 's' : ''} open`, link: '/corrective', severity: 'warning' })
}

async function checkProbeCalibration(items, vid) {
  const { data: records } = await supabase.from('probe_calibrations').select('id, calibrated_at').eq('venue_id', vid).order('calibrated_at', { ascending: false }).limit(1)
  const last = records?.[0]
  if (!last) { items.push({ id: 'probe-never', type: 'probe_overdue', message: 'No probe calibrations on record -- calibrate your probes', link: '/probe', severity: 'warning' }); return }
  const daysSince = Math.floor((new Date() - new Date(last.calibrated_at)) / 86400000)
  if (daysSince > 30) items.push({ id: 'probe-overdue', type: 'probe_overdue', message: `Probe calibration overdue -- last done ${daysSince} days ago`, link: '/probe', severity: 'warning' })
}

async function checkTimeOffRequests(items, vid) {
  const { count } = await supabase.from('time_off_requests').select('id', { count: 'exact', head: true }).eq('venue_id', vid).eq('status', 'pending')
  if (count > 0) items.push({ id: 'time-off-pending', type: 'time_off_pending', message: `${count} time-off request${count > 1 ? 's' : ''} awaiting approval`, link: '/time-off', severity: 'warning' })
}

async function checkHourEdits(items, vid) {
  const since = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('hour_edit_log')
    .select('staff_name, shift_date, created_at')
    .eq('venue_id', vid)
    .gte('created_at', since + 'T00:00:00')
    .order('created_at', { ascending: false })
    .limit(20)
  if (!data?.length) return
  const count = data.length
  const names = [...new Set(data.map((r) => r.staff_name).filter(Boolean))]
  items.push({
    id: 'hour-edits',
    type: 'hour_edit',
    message: `${count} manual hour edit${count > 1 ? 's' : ''} in the last 7 days: ${names.slice(0, 3).join(', ')}`,
    link: '/timesheet',
    severity: 'info',
  })
}
