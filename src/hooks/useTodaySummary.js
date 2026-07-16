import { useEffect, useRef, useState } from 'react'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { readPersisted, writePersisted, clearPersisted } from '../lib/persistedCache'

// ── Module-level SWR cache ─────────────────────────────────────────────────
// Survives component unmount/remount (single-page navigation), and is backed
// by localStorage so a cold app open renders the last-known summary
// immediately while a background refresh fires.
// Key: `${venueId}:${dateStr}`  Value: { data, ts }
const _cache = new Map()
const STALE_MS  = 90_000   // show stale + revalidate after 90 s
const FRESH_MS  = 20_000   // don't revalidate at all if data is < 20 s old

function cacheGet(key) {
  const entry = _cache.get(key)
  if (entry) return entry
  const persisted = readPersisted('today_summary', key)
  if (persisted) {
    // Seed as just-past-fresh: shown immediately via the stale-hit path,
    // which also kicks off a background revalidation.
    const seeded = { data: persisted, ts: Date.now() - FRESH_MS - 1000 }
    _cache.set(key, seeded)
    return seeded
  }
  return null
}
function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() })
  writePersisted('today_summary', key, data)
}

/** Expose so other modules can bust the cache after a mutation (e.g. clock-in). */
export function invalidateSummaryCache(venueId) {
  for (const k of _cache.keys()) {
    if (k.startsWith(venueId + ':')) _cache.delete(k)
  }
  clearPersisted('today_summary')
}

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
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const cacheKey = venueId ? `${venueId}:${todayStr}` : null
  const cached   = cacheKey ? cacheGet(cacheKey) : null

  const [summary, setSummary]         = useState(cached?.data ?? null)
  const [loading, setLoading]         = useState(!cached)
  const [closedToday, setClosedToday] = useState(false)

  // track whether we already kicked off a background revalidation this mount
  const revalidating = useRef(false)

  useEffect(() => {
    if (!venueId) return

    const key   = `${venueId}:${todayStr}`
    const entry = cacheGet(key)
    const age   = entry ? Date.now() - entry.ts : Infinity

    // Fresh enough — no fetch needed
    if (entry && age < FRESH_MS) {
      setSummary(entry.data)
      setLoading(false)
      return
    }

    // Stale hit — show immediately, revalidate in background
    if (entry && age < STALE_MS) {
      setSummary(entry.data)
      setLoading(false)
      if (revalidating.current) return
      revalidating.current = true
      // fall through to fetch (background — setLoading stays false)
    }

    const today = new Date()
    const dayStart = startOfDay(today).toISOString()
    const dayEnd   = endOfDay(today).toISOString()
    const ninetyDaysAgo = subDays(today, 90).toISOString()

    let cancelled = false
    const fetchAll = async () => {
      if (!entry) setLoading(true)
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

      const due = (key) => isActionDueToday(key, actionSchedules)

      // All queries run in parallel — including the venue-closure check,
      // cleaning completions and shift IDs, so the whole summary needs a
      // single round-trip (plus one follow-up for duties when shifts exist).
      // On a closure day the other results are simply discarded.
      const [
        closures,
        cleaning, rota, opening, closing, fridges, fridgeLogs,
        leaveReqs, critActions, cookingTemps, hotHoldingLogs,
        coolingLogs, dutyShifts, totalChecksRes, cleaningCompletions,
      ] = await Promise.all([
        supabase
          .from('venue_closures')
          .select('id, reason')
          .eq('venue_id', venueId)
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .limit(1),
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
        // Fetch shifts with IDs so duty_assignments query can happen in the second round-trip
        supabase.from('shifts').select('id').eq('venue_id', venueId).eq('shift_date', todayStr),
        supabase.from('opening_closing_checks').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('is_active', true),
        // Fetch cleaning completions upfront — avoids a sequential fetch after cleaning_tasks
        due('cleaning_tasks')
          ? supabase.from('cleaning_completions')
              .select('cleaning_task_id, completed_at')
              .eq('venue_id', venueId)
              .gte('completed_at', ninetyDaysAgo)
              .order('completed_at', { ascending: false })
          : { data: [] },
      ])

      if (cancelled) return

      // ── Venue closed today? Discard the batch and report empty ───────────
      if (closures.data?.length) {
        setClosedToday(closures.data[0].reason || true)
        setSummary(emptySummary())
        setLoading(false)
        revalidating.current = false
        return
      }
      setClosedToday(false)

      // ── Cleaning overdue count (no extra round-trip needed) ──────────────
      let overdueCount = 0
      if (due('cleaning_tasks') && cleaning.data?.length) {
        const freqDays = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }
        const now = new Date()
        const latestByTask = new Map()
        for (const c of (cleaningCompletions.data ?? [])) {
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

      // ── Duties: one more round-trip (needs shift IDs from above) ─────────
      let dutiesAssigned = 0, dutiesCompleted = 0
      const todayShiftIds = (dutyShifts.data ?? []).map(s => s.id)
      if (todayShiftIds.length) {
        // Fetch duty_assignments with completions embedded — single query instead of two
        const { data: dutyAssignments } = await supabase
          .from('duty_assignments')
          .select('id, duty_template_id, duty_template_items!duty_template_id(id), duty_item_completions(duty_template_item_id)')
          .in('shift_id', todayShiftIds)

        if (!cancelled && dutyAssignments?.length) {
          dutiesAssigned = dutyAssignments.length
          dutiesCompleted = dutyAssignments.filter(a => {
            const total = a.duty_template_items?.length ?? 0
            const done  = a.duty_item_completions?.length ?? 0
            return total > 0 && done >= total
          }).length
        }
      }

      if (cancelled) return

      const fresh = {
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
      }
      cacheSet(key, fresh)
      setSummary(fresh)
      setLoading(false)
      revalidating.current = false
      } catch {
        if (!cancelled) {
          if (!entry) { setSummary(emptySummary()); setLoading(false) }
          revalidating.current = false
        }
      }
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId])

  return { summary, loading, closedToday }
}
