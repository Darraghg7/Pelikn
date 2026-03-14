import { useState, useEffect } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'

/**
 * Computes manager notifications:
 * - Pending swap requests
 * - Late clock-ins today (> 2 min grace after shift start)
 * - Incomplete tasks from yesterday
 * - Repeat offenders (3+ late clock-ins in last 30 days)
 */
export function useNotifications(isManager) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (!isManager) { setLoading(false); return }
    load().then(setNotifications).finally(() => setLoading(false))
  }, [isManager])

  return { notifications, count: notifications.length, loading }
}

async function load() {
  const items = []
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  await Promise.all([
    checkSwapRequests(items),
    checkLateClockIns(items, today),
    checkIncompleteTasks(items, yesterday),
    checkRepeatOffenders(items),
  ])

  return items
}

async function checkSwapRequests(items) {
  const { count } = await supabase
    .from('shift_swaps')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (count > 0) {
    items.push({
      id: 'swaps',
      type: 'swap_request',
      message: `${count} shift swap request${count > 1 ? 's' : ''} pending`,
      link: '/rota',
      severity: 'warning',
    })
  }
}

async function checkLateClockIns(items, today) {
  const [{ data: shifts }, { data: clockIns }] = await Promise.all([
    supabase.from('shifts').select('staff_id, start_time, staff:staff_id(name)').eq('shift_date', today),
    supabase.from('clock_events')
      .select('staff_id, occurred_at, staff:staff_id(name)')
      .eq('event_type', 'clock_in')
      .gte('occurred_at', today + 'T00:00:00')
      .lte('occurred_at', today + 'T23:59:59'),
  ])

  if (!shifts?.length || !clockIns?.length) return

  const lateOnes = []
  for (const ci of clockIns) {
    const shift = shifts.find(s => s.staff_id === ci.staff_id)
    if (!shift) continue
    const [h, m] = shift.start_time.split(':').map(Number)
    const shiftStart = new Date(today + 'T' + shift.start_time)
    const clockInTime = parseISO(ci.occurred_at)
    const diffMinutes = (clockInTime - shiftStart) / 60000
    if (diffMinutes > 2) {
      lateOnes.push(ci.staff?.name ?? 'Unknown')
    }
  }

  if (lateOnes.length > 0) {
    items.push({
      id: 'late-today',
      type: 'late_clock_in',
      message: `Late clock-in today: ${lateOnes.join(', ')}`,
      link: '/timesheet',
      severity: 'warning',
    })
  }
}

async function checkIncompleteTasks(items, yesterday) {
  const [{ data: templates }, { data: completions }] = await Promise.all([
    supabase.from('task_templates').select('id, title').eq('is_active', true),
    supabase.from('task_completions').select('task_template_id').eq('completion_date', yesterday),
  ])

  if (!templates?.length) return

  const completedIds = new Set((completions ?? []).map(c => c.task_template_id))
  const missed = templates.filter(t => !completedIds.has(t.id))

  if (missed.length > 0) {
    items.push({
      id: 'incomplete-yesterday',
      type: 'incomplete_tasks',
      message: `${missed.length} task${missed.length > 1 ? 's' : ''} not completed yesterday`,
      link: '/tasks',
      severity: 'warning',
    })
  }
}

async function checkRepeatOffenders(items) {
  const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  const [{ data: shifts }, { data: clockIns }] = await Promise.all([
    supabase.from('shifts').select('staff_id, shift_date, start_time, staff:staff_id(name)')
      .gte('shift_date', since).lte('shift_date', today),
    supabase.from('clock_events')
      .select('staff_id, occurred_at')
      .eq('event_type', 'clock_in')
      .gte('occurred_at', since + 'T00:00:00'),
  ])

  if (!shifts?.length || !clockIns?.length) return

  // Count late clock-ins per staff member
  const lateCounts = {}
  const staffNames = {}
  for (const shift of shifts) {
    const ci = clockIns.find(c =>
      c.staff_id === shift.staff_id &&
      c.occurred_at.startsWith(shift.shift_date)
    )
    if (!ci) continue
    const shiftStart = new Date(shift.shift_date + 'T' + shift.start_time)
    const clockInTime = parseISO(ci.occurred_at)
    if ((clockInTime - shiftStart) / 60000 > 2) {
      lateCounts[shift.staff_id] = (lateCounts[shift.staff_id] ?? 0) + 1
      staffNames[shift.staff_id] = shift.staff?.name ?? 'Unknown'
    }
  }

  const offenders = Object.entries(lateCounts)
    .filter(([, count]) => count >= 3)
    .map(([id, count]) => `${staffNames[id]} (${count}×)`)

  if (offenders.length > 0) {
    items.push({
      id: 'repeat-offenders',
      type: 'repeat_offender',
      message: `Repeat late clock-ins (30 days): ${offenders.join(', ')}`,
      link: '/timesheet',
      severity: 'warning',
    })
  }
}
