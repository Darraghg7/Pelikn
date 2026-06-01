import { useEffect, useState } from 'react'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'

export function isActionDueToday(scheduleKey, actionSchedules) {
  if (!scheduleKey) return true
  const schedule = actionSchedules?.[scheduleKey]
  if (!schedule) return true
  if (!schedule.enabled) return false
  if (!schedule.days?.length) return false
  const todayDow = (new Date().getDay() + 6) % 7
  return schedule.days.includes(todayDow)
}

function emptySummary() {
  return {
    overdueClean: 0,
    onShiftToday: 0,
    checksToday: 0,
    closingChecksToday: 0,
    uncheckedFridges: 0,
    totalFridges: 0,
    totalChecks: 0,
    pendingLeave: 0,
    criticalActions: 0,
    cookingTempsToday: 0,
    hotHoldingToday: 0,
    coolingLogsToday: 0,
    dutiesAssigned: 0,
    dutiesCompleted: 0,
  }
}

export function useTodaySummary(venueId, closedDays = [], actionSchedules = {}) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [closedToday, setClosedToday] = useState(false)

  useEffect(() => {
    if (!venueId) return
    const today = new Date()
    const dayStart = startOfDay(today).toISOString()
    const dayEnd   = endOfDay(today).toISOString()
    const todayStr = format(today, 'yyyy-MM-dd')

    let cancelled = false
    const fetchAll = async () => {
      setLoading(true)
      try {

      const todayDow = (today.getDay() + 6) % 7
      if (closedDays.includes(todayDow)) {
        if (!cancelled) {
          setClosedToday(true)
          setSummary(emptySummary())
          setLoading(false)
        }
        return
      }

      const { data: closureRows } = await supabase
        .from('venue_closures')
        .select('id, reason')
        .eq('venue_id', venueId)
        .lte('start_date', todayStr)
        .gte('end_date', todayStr)
        .limit(1)
      if (cancelled) return
      if (closureRows?.length) {
        setClosedToday(closureRows[0].reason || true)
        setSummary(emptySummary())
        setLoading(false)
        return
      }
      setClosedToday(false)

      const due = (key) => isActionDueToday(key, actionSchedules)

      const [
        cleaning, rota, opening, closing, fridges, fridgeLogs,
        leaveReqs, critActions, cookingTemps, hotHoldingLogs,
        coolingLogs, dutyShifts, totalChecksRes,
      ] = await Promise.all([
        due('cleaning_tasks')
          ? supabase.from('cleaning_tasks').select('id, frequency').eq('venue_id', venueId).eq('is_active', true)
          : { data: [] },
        supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('shift_date', todayStr),
        due('opening_checks')
          ? supabase.from('opening_closing_completions')
              .select('id', { count: 'exact', head: true })
              .eq('venue_id', venueId).eq('session_type', 'opening').gte('completed_at', dayStart).lte('completed_at', dayEnd)
          : { count: 0 },
        due('closing_checks')
          ? supabase.from('opening_closing_completions')
              .select('id', { count: 'exact', head: true })
              .eq('venue_id', venueId).eq('session_type', 'closing').gte('completed_at', dayStart).lte('completed_at', dayEnd)
          : { count: 0 },
        due('fridge_checks')
          ? supabase.from('fridges').select('id').eq('venue_id', venueId).eq('is_active', true)
          : { data: [] },
        due('fridge_checks')
          ? supabase.from('fridge_temperature_logs').select('fridge_id').eq('venue_id', venueId).gte('logged_at', dayStart).lte('logged_at', dayEnd)
          : { data: [] },
        supabase.from('time_off_requests').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'pending'),
        supabase.from('corrective_actions').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'open').eq('severity', 'critical'),
        due('cooking_temps')
          ? supabase.from('cooking_temp_logs').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).gte('logged_at', dayStart).lte('logged_at', dayEnd)
          : { count: 0 },
        due('hot_holding')
          ? supabase.from('hot_holding_logs').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).gte('logged_at', dayStart).lte('logged_at', dayEnd)
          : { count: 0 },
        due('cooling_logs')
          ? supabase.from('cooling_logs').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).gte('logged_at', dayStart).lte('logged_at', dayEnd)
          : { count: 0 },
        supabase.from('shifts').select('id').eq('venue_id', venueId).eq('shift_date', todayStr),
        supabase.from('opening_closing_checks').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('is_active', true),
      ])

      if (cancelled) return

      let overdueCount = 0
      if (due('cleaning_tasks') && cleaning.data?.length) {
        const ninetyDaysAgo = subDays(new Date(), 90).toISOString()
        const { data: completions } = await supabase
          .from('cleaning_completions')
          .select('cleaning_task_id, completed_at')
          .eq('venue_id', venueId)
          .gte('completed_at', ninetyDaysAgo)
          .order('completed_at', { ascending: false })
        if (cancelled) return
        const freqDays = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }
        const now = new Date()
        const latestByTask = new Map()
        for (const c of (completions ?? [])) {
          if (!latestByTask.has(c.cleaning_task_id)) latestByTask.set(c.cleaning_task_id, c)
        }
        for (const t of cleaning.data) {
          const last = latestByTask.get(t.id)
          if (!last) { overdueCount++; continue }
          if ((now - new Date(last.completed_at)) / 86400000 > (freqDays[t.frequency] ?? 1)) overdueCount++
        }
      }

      const checkedIds = new Set((fridgeLogs.data ?? []).map(l => l.fridge_id))
      const uncheckedFridges = (fridges.data ?? []).filter(f => !checkedIds.has(f.id)).length
      const totalFridges = fridges.data?.length ?? 0

      let dutiesAssigned = 0, dutiesCompleted = 0
      if (dutyShifts.data?.length) {
        const todayShiftIds = dutyShifts.data.map(s => s.id)
        const { data: dutyAssignments } = await supabase
          .from('duty_assignments')
          .select('id, duty_template_id, duty_template_items!duty_template_id ( id )')
          .in('shift_id', todayShiftIds)
        if (!cancelled && dutyAssignments?.length) {
          dutiesAssigned = dutyAssignments.length
          const assignmentIds = dutyAssignments.map(a => a.id)
          const { data: itemCompletions } = await supabase
            .from('duty_item_completions')
            .select('duty_assignment_id, duty_template_item_id')
            .in('duty_assignment_id', assignmentIds)
          const completedByAssignment = (itemCompletions ?? []).reduce((acc, c) => {
            acc[c.duty_assignment_id] = (acc[c.duty_assignment_id] ?? 0) + 1
            return acc
          }, {})
          dutiesCompleted = dutyAssignments.filter(a => {
            const total = a.duty_template_items?.length ?? 0
            return total > 0 && (completedByAssignment[a.id] ?? 0) >= total
          }).length
        }
      }

      setSummary({
        overdueClean:       overdueCount,
        onShiftToday:       rota.count ?? 0,
        checksToday:        opening.count ?? 0,
        closingChecksToday: closing.count ?? 0,
        uncheckedFridges,
        totalFridges,
        totalChecks:        totalChecksRes.count ?? 0,
        pendingLeave:       leaveReqs.count ?? 0,
        criticalActions:    critActions.count ?? 0,
        cookingTempsToday:  cookingTemps.count ?? 0,
        hotHoldingToday:    hotHoldingLogs.count ?? 0,
        coolingLogsToday:   coolingLogs.count ?? 0,
        dutiesAssigned,
        dutiesCompleted,
      })
      setLoading(false)
      } catch {
        if (!cancelled) { setSummary(emptySummary()); setLoading(false) }
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [venueId, closedDays, actionSchedules])

  return { summary, loading, closedToday }
}
