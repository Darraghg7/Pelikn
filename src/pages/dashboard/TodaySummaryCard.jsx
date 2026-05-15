import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { TODAY_ITEM_REGISTRY, DEFAULT_TODAY_ITEMS } from './todayItemRegistry'

function emptySummary() {
  return {
    overdueClean: 0,
    onShiftToday: 0,
    checksToday: 0,
    closingChecksToday: 0,
    uncheckedFridges: 0,
    pendingLeave: 0,
    criticalActions: 0,
    cookingTempsToday: 0,
    hotHoldingToday: 0,
    coolingLogsToday: 0,
    dutiesAssigned: 0,
    dutiesCompleted: 0,
  }
}

function isActionDueToday(scheduleKey, actionSchedules) {
  if (!scheduleKey) return true
  const schedule = actionSchedules?.[scheduleKey]
  if (!schedule) return true
  if (!schedule.enabled) return false
  if (!schedule.days?.length) return false
  const todayDow = (new Date().getDay() + 6) % 7
  return schedule.days.includes(todayDow)
}

function useTodaySummary(venueId, closedDays = [], actionSchedules = {}) {
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

      const [cleaning, rota, opening, closing, fridges, fridgeLogs, leaveReqs, critActions, cookingTemps, hotHoldingLogs, coolingLogs, dutyShifts] = await Promise.all([
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
          const { data: completions } = await supabase
            .from('duty_item_completions')
            .select('duty_assignment_id, duty_template_item_id')
            .in('duty_assignment_id', assignmentIds)
          const completedByAssignment = (completions ?? []).reduce((acc, c) => {
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
        uncheckedFridges:   uncheckedFridges,
        pendingLeave:       leaveReqs.count ?? 0,
        criticalActions:    critActions.count ?? 0,
        cookingTempsToday:  cookingTemps.count ?? 0,
        hotHoldingToday:    hotHoldingLogs.count ?? 0,
        coolingLogsToday:   coolingLogs.count ?? 0,
        dutiesAssigned,
        dutiesCompleted,
      })
      setLoading(false)
    }
    fetchAll()
    return () => { cancelled = true }
  }, [venueId, closedDays, actionSchedules])

  return { summary, loading, closedToday }
}

export default function TodaySummaryCard({ venueId, closedDays, itemIds, actionSchedules }) {
  const { venueSlug } = useVenue()
  const { isEnabled } = useVenueFeatures()
  const { summary, loading, closedToday } = useTodaySummary(venueId, closedDays, actionSchedules)
  const vp = (p) => `/v/${venueSlug}${p}`

  const activeItems = (itemIds?.length ? itemIds : DEFAULT_TODAY_ITEMS)
    .map(id => TODAY_ITEM_REGISTRY[id])
    .filter(item => {
      if (!item) return false
      if (item.feature && !isEnabled(item.feature)) return false
      if (item.scheduleKey && !isActionDueToday(item.scheduleKey, actionSchedules)) return false
      return true
    })

  const actions = summary
    ? activeItems.map(item => item.action?.(summary, vp)).filter(Boolean)
    : []

  const urgencyBorder = { warn: 'border-warning', danger: 'border-danger', info: 'border-accent' }
  const urgencyText = { warn: 'text-warning', danger: 'text-danger', info: 'text-accent' }

  if (!loading && closedToday) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="px-5 py-6 text-center">
          <span className="text-charcoal/25 mb-3 flex justify-center"><svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></span>
          <p className="text-xl font-bold text-charcoal">Venue closed today</p>
          <p className="text-sm text-charcoal/45 mt-1">
            {typeof closedToday === 'string' ? closedToday : 'Enjoy the break!'}
          </p>
        </div>
        {summary && actions.length > 0 && (
          <div className="border-t border-charcoal/6 divide-y divide-charcoal/6">
            {actions.map((a) => (
              <Link key={a.to} to={a.to} className={`flex items-center border-l-[3px] ${urgencyBorder[a.urgency]} pl-4 pr-5 py-3.5 hover:bg-charcoal/3 transition-colors`}>
                <p className={`text-sm flex-1 font-medium ${urgencyText[a.urgency]}`}>{a.label}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-charcoal/40 mb-3">Today</p>
        {loading || !summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[100px] rounded-xl bg-charcoal/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {summary.overdueClean > 0 && (
              <Link to={vp('/cleaning')} className="flex items-center gap-2.5 px-3.5 py-2.5 mb-3 rounded-xl bg-danger/8 border border-danger/15 text-danger hover:bg-danger/12 transition-colors">
                <span className="w-5 h-5 rounded-full bg-danger/18 flex items-center justify-center shrink-0">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </span>
                <p className="text-sm font-semibold flex-1">{summary.overdueClean} overdue {summary.overdueClean === 1 ? 'clean' : 'cleans'}</p>
                <span className="font-mono text-xs opacity-60">→</span>
              </Link>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeItems.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-charcoal/15 py-6 px-3 text-center">
                  <p className="text-sm text-charcoal/35">No Today items selected</p>
                </div>
              ) : activeItems.map(item => {
                const value = item.metric(summary) ?? 0
                const isDanger = item.dangerWhenPositive && value > 0
                const isGood   = item.dangerWhenPositive && value === 0
                return (
                  <div key={item.id} className="flex flex-col gap-2 border border-charcoal/10 rounded-xl p-4 min-h-[100px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDanger ? 'bg-danger' : isGood ? 'bg-success' : 'bg-charcoal/20'}`} />
                      <span className="font-mono text-[10px] text-charcoal/40 uppercase tracking-[0.08em] leading-none">{item.metricLabel}</span>
                    </div>
                    <div className={`text-[34px] font-medium tracking-[-0.035em] leading-none tabular-nums ${isDanger ? 'text-danger' : 'text-charcoal'}`}>
                      {value}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Action items */}
      {!loading && summary && (
        actions.length === 0 ? (
          <div className="border-t border-charcoal/6 px-5 py-3.5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
            <p className="text-sm font-medium text-charcoal/50">All checks on track</p>
          </div>
        ) : (
          <div className="border-t border-charcoal/6 divide-y divide-charcoal/6">
            {actions.map((a) => (
              <Link key={a.to} to={a.to} className={`flex items-center border-l-[3px] ${urgencyBorder[a.urgency]} pl-4 pr-5 py-3.5 hover:bg-charcoal/3 transition-colors`}>
                <p className={`text-sm flex-1 font-medium ${urgencyText[a.urgency]}`}>{a.label}</p>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  )
}
