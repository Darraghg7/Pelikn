import { useEffect, useRef, useState } from 'react'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { readPersisted, writePersisted, clearPersisted } from '../lib/persistedCache'
import { onDataWrite } from '../lib/cacheBus'
import { captureSilent } from '../lib/reportError'
import { isCheckRequired } from '../lib/temperatureChecks'

// ── Module-level SWR cache ─────────────────────────────────────────────────
// Survives component unmount/remount (single-page navigation), and is backed
// by localStorage so a cold app open renders the last-known summary
// immediately while a background refresh fires.
// Key: `${venueId}:${dateStr}:${gating}`  Value: { data, closedToday, ts }
// The gating segment is the schedule signature — see scheduleSignature().
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
    const seeded = { data: persisted.data ?? persisted, closedToday: persisted.closedToday ?? false, ts: Date.now() - FRESH_MS - 1000 }
    _cache.set(key, seeded)
    return seeded
  }
  return null
}
// When the summary last came back from the server. Drives the backstop timer,
// which needs "how stale are the tiles" — a question the per-key cache cannot
// answer once invalidation has emptied it.
let _lastRefreshAt = 0

function cacheSet(key, data, closedToday = false) {
  _cache.set(key, { data, closedToday, ts: Date.now() })
  _lastRefreshAt = Date.now()
  writePersisted('today_summary', key, { data, closedToday })
}

// ── In-flight coalescing ────────────────────────────────────────────────────
// Three components mount this hook on a manager dashboard (the page itself,
// the mobile dashboard and TodaySummaryCard). They mount in the same tick, so
// all three miss the cache and all three fetch — the single-round-trip
// snapshot RPC was being called three times per load. Sharing the promise per
// cache key means concurrent callers wait on one request; the module cache
// then serves everyone once it resolves.
const _inFlight = new Map()

function fetchOnce(key, fn) {
  const pending = _inFlight.get(key)
  if (pending) return pending
  // Promise.resolve() is load-bearing, not defensive tidying. A supabase query
  // builder is a *thenable*, not a Promise: it implements then() and nothing
  // else. Calling .finally() straight on it threw TypeError synchronously,
  // which the caller's try/catch swallowed into an all-zeros summary — every
  // Today tile read 0 no matter what had been logged. Adopting the thenable
  // into a real Promise first is what makes .finally() exist.
  const p = Promise.resolve(fn()).finally(() => _inFlight.delete(key))
  _inFlight.set(key, p)
  return p
}

/** Expose so other modules can bust the cache after a mutation (e.g. clock-in). */
export function invalidateSummaryCache(venueId) {
  if (!venueId) { _cache.clear(); clearPersisted('today_summary'); return }
  for (const k of _cache.keys()) {
    if (k.startsWith(venueId + ':')) _cache.delete(k)
  }
  clearPersisted('today_summary')
}

// ── Auto-invalidation on write ──────────────────────────────────────────────
// Every table the summary counts from. A successful write to any of them means
// at least one tile is now showing a number that is no longer true — most
// visibly "Checks done", which stayed at its pre-write value because the cache
// was still inside its 20 s fresh window when the manager navigated back.
//
// This used to depend on each write site remembering to call
// invalidateSummaryCache(). None of them did. Subscribing to the write bus
// instead means the tiles stay correct no matter which screen did the writing.
const SUMMARY_TABLES = new Set([
  'opening_closing_completions', 'opening_closing_checks',
  'fridge_temperature_logs', 'fridges',
  'cleaning_completions', 'cleaning_tasks',
  'cooking_temp_logs', 'hot_holding_logs', 'cooling_logs',
  'corrective_actions', 'time_off_requests',
  'shifts', 'duty_assignments', 'duty_item_completions', 'duty_template_items',
  'venue_closures',
])

// Mounted hooks register here so a write refreshes the tiles in place — the
// manager may still be looking at the dashboard (or at a sheet layered over
// it) when the write lands, with no remount coming to pick the change up.
const _subscribers = new Set()
let _notifyTimer = null

function notifySubscribers() {
  for (const fn of _subscribers) fn()
}

// Debounce before refetching. A checklist marked off writes a row per item and
// realtime echoes each one back, so this collapses a burst into one refresh.
// Short enough to still read as instant.
const REFRESH_DEBOUNCE_MS = 300

/** Drop the cache and refresh every mounted hook, coalescing bursts. */
function scheduleSummaryRefresh() {
  // Drop the cache immediately: a screen mounting inside the debounce window
  // must not be served numbers we already know are stale.
  invalidateSummaryCache(null)

  if (_notifyTimer) clearTimeout(_notifyTimer)
  _notifyTimer = setTimeout(() => {
    _notifyTimer = null
    notifySubscribers()
  }, REFRESH_DEBOUNCE_MS)
}

onDataWrite((table) => {
  if (SUMMARY_TABLES.has(table)) scheduleSummaryRefresh()
})

// ── Live updates ────────────────────────────────────────────────────────────
// Writes made on *this* device already refresh the tiles via the bus above.
// The dashboard's real job is showing what everyone else is doing: a chef
// logging a fridge temp on their phone has to land on the manager's tablet
// without anyone touching it. Only the server can tell us about that, so the
// summary tables are watched over a realtime channel.
//
// duty_template_items is deliberately absent. postgres_changes filters on a
// real column and it has no venue_id, so it could only be watched unfiltered —
// every venue's edits, to every client. It is template config rather than
// operational data, edited from this device when it changes at all, so the
// write bus already covers the case that matters.
const REALTIME_TABLES = [...SUMMARY_TABLES].filter(t => t !== 'duty_template_items')

let _rtChannel   = null
let _rtVenueId   = null
let _rtRefs      = 0
let _rtConnected = false

function teardownRealtime() {
  if (_rtChannel) {
    try { supabase.removeChannel(_rtChannel) } catch { /* already gone */ }
  }
  _rtChannel   = null
  _rtVenueId   = null
  _rtRefs      = 0
  _rtConnected = false
}

/**
 * Join the live channel for a venue, sharing one subscription across every
 * mounted hook. Returns the release function for the caller's effect cleanup.
 */
function acquireRealtime(venueId) {
  if (_rtVenueId !== venueId) teardownRealtime()
  _rtVenueId = venueId
  _rtRefs += 1

  if (!_rtChannel) {
    try {
      const channel = supabase.channel(`today-summary:${venueId}`)
      for (const table of REALTIME_TABLES) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `venue_id=eq.${venueId}` },
          scheduleSummaryRefresh,
        )
      }
      channel.subscribe((status) => { _rtConnected = status === 'SUBSCRIBED' })
      _rtChannel = channel
    } catch {
      // No realtime here. The poll below notices _rtConnected never went true
      // and keeps the tiles current the slow way.
      _rtConnected = false
    }
  }

  return () => {
    // A release from a previous venue's channel must not decrement this one.
    if (_rtVenueId !== venueId) return
    _rtRefs -= 1
    if (_rtRefs <= 0) teardownRealtime()
  }
}

// ── Backstop ────────────────────────────────────────────────────────────────
// Realtime is the live path, not a guaranteed one: the socket can drop, the
// tables may not be in the publication yet, and a suspended tab misses events
// entirely. So the tiles are still checked on a timer — but only as far behind
// as they are allowed to get, which is very different depending on whether the
// live channel is actually up.
const POLL_MS          = 30_000    // how often we consider refreshing
const LIVE_MAX_AGE_MS  = 120_000   // channel up: pure backstop
const DEAD_MAX_AGE_MS  = 30_000    // channel down: this is the update path

if (typeof document !== 'undefined') {
  const refreshIfDue = (maxAgeMs) => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - _lastRefreshAt < maxAgeMs) return
    notifySubscribers()
  }
  // Coming back to the app is the moment the numbers are most likely stale,
  // and the moment a dropped socket is most likely to still be dropped.
  const onReturn = () => refreshIfDue(0)
  document.addEventListener('visibilitychange', onReturn)
  window.addEventListener('focus', onReturn)
  // …and a tick for the tablet that is never hidden and never refocused. Also
  // what rolls the dashboard onto the new day at midnight: the nudge re-renders
  // the hook, which recomputes todayStr and with it the cache key.
  setInterval(() => {
    refreshIfDue(_rtConnected ? LIVE_MAX_AGE_MS : DEAD_MAX_AGE_MS)
  }, POLL_MS)
}

// Counts the summary reports as zero when the check is not scheduled today.
// The gating is therefore baked into the cached value, which is why it belongs
// in the cache key — see the signature comment in the hook.
const GATED_SCHEDULE_KEYS = [
  'opening_checks', 'closing_checks', 'fridge_checks',
  'cleaning_tasks', 'cooking_temps', 'hot_holding', 'cooling_logs',
]

function scheduleSignature(actionSchedules) {
  return GATED_SCHEDULE_KEYS
    .map(k => (isActionDueToday(k, actionSchedules) ? '1' : '0'))
    .join('')
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

  // Which checks are due today, as a 7-character string. Two jobs:
  //
  // It is a dependency the fetch effect can actually be keyed on. The effect
  // gates every count through these schedules but only listed venueId, so
  // editing a schedule in Settings left the tiles showing the gating they were
  // fetched under. Depending on `actionSchedules` itself would not work —
  // useAppSettings rebuilds the object every render, and callers pass object
  // literals, so the effect would re-run forever.
  //
  // It also belongs in the cache key. A check that is not due reads as zero, so
  // two different schedules produce two different summaries for the same venue
  // and day; sharing one cache entry between them would hand back the other
  // one's numbers. Changed gating simply reads as a miss.
  const gating = scheduleSignature(actionSchedules)

  const cacheKey = venueId ? `${venueId}:${todayStr}:${gating}` : null
  const cached   = cacheKey ? cacheGet(cacheKey) : null

  const [summary, setSummary]         = useState(cached?.data ?? null)
  const [loading, setLoading]         = useState(!cached)
  const [closedToday, setClosedToday] = useState(false)

  // track whether we already kicked off a background revalidation this mount
  const revalidating = useRef(false)

  // Bumped when something invalidates the cache, to re-run the fetch below.
  const [refreshTick, setRefreshTick] = useState(0)
  useEffect(() => {
    const refresh = () => setRefreshTick(t => t + 1)
    _subscribers.add(refresh)
    return () => { _subscribers.delete(refresh) }
  }, [])

  // Join the venue's live channel. Shared across every mounted hook, so the
  // three on a manager dashboard cost one subscription between them.
  useEffect(() => {
    if (!venueId) return
    return acquireRealtime(venueId)
  }, [venueId])

  // Read in the fetch effect without making `summary` a dependency of it —
  // depending on the value it sets would re-run the effect on every fetch.
  const summaryRef = useRef(summary)
  summaryRef.current = summary

  useEffect(() => {
    if (!venueId) return

    const key = `${venueId}:${todayStr}:${gating}`

    const entry = cacheGet(key)
    const age   = entry ? Date.now() - entry.ts : Infinity

    // Fresh enough — no fetch needed
    if (entry && age < FRESH_MS) {
      setSummary(entry.data)
      setClosedToday(entry.closedToday)
      setLoading(false)
      return
    }

    // Stale hit — show immediately, revalidate in background
    if (entry && age < STALE_MS) {
      setSummary(entry.data)
      setClosedToday(entry.closedToday)
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

    // ── Fast path: one RPC for the whole summary ────────────────────────────
    // get_dashboard_snapshot (migration 095) runs every query below next to
    // the data. Returns null if the migration hasn't been applied yet, in
    // which case we fall back to the original multi-query path.
    const fetchViaSnapshot = async () => {
      const { data, error } = await fetchOnce(`snap:${key}`, () =>
        supabase.rpc('get_dashboard_snapshot', {
          p_venue_id:  venueId,
          p_date:      todayStr,
          p_day_start: dayStart,
          p_day_end:   dayEnd,
        })
      )
      if (error || !data) return null

      const due = (k) => isActionDueToday(k, actionSchedules)

      // The RPC always computes everything; the action-schedule gating stays
      // on the client because the schedules live in app settings, not the DB.
      // A check that isn't due today reads as zero, exactly as before.
      //
      // checksToday/closingChecksToday are the exception: they count actual
      // completions, which are real regardless of whether today was
      // "scheduled" for them (a schedule edited after the fact, or checks
      // done ahead of the configured days, shouldn't make completed work
      // disappear). Zeroing them here made the dashboard/Checks-hub card
      // read "0/14" while the detail page — which never gates — correctly
      // showed the checks that had actually been recorded.
      return {
        summary: {
          overdueClean:       due('cleaning_tasks') ? data.overdueClean       : 0,
          onShiftToday:       data.onShiftToday     ?? 0,
          checksToday:        data.checksToday        ?? 0,
          closingChecksToday: data.closingChecksToday ?? 0,
          uncheckedFridges:   due('fridge_checks')  ? data.uncheckedFridges   : 0,
          totalFridges:       due('fridge_checks')  ? data.totalFridges       : 0,
          totalChecks:        data.totalChecks      ?? 0,
          pendingLeave:       data.pendingLeave     ?? 0,
          criticalActions:    data.criticalActions  ?? 0,
          cookingTempsToday:  due('cooking_temps')  ? data.cookingTempsToday  : 0,
          hotHoldingToday:    due('hot_holding')    ? data.hotHoldingToday    : 0,
          coolingLogsToday:   due('cooling_logs')   ? data.coolingLogsToday   : 0,
          dutiesAssigned:     data.dutiesAssigned   ?? 0,
          dutiesCompleted:    data.dutiesCompleted  ?? 0,
        },
        isClosed:      !!data.isClosed,
        closureReason: data.closureReason,
      }
    }

    const fetchAll = async () => {
      // Only show skeletons when there is nothing to show. A post-write refresh
      // has no cache entry (it was just dropped) but does have numbers on
      // screen — those stay up, and swap for the new ones when the fetch lands.
      if (!entry && !summaryRef.current) setLoading(true)
      try {

      const due = (key) => isActionDueToday(key, actionSchedules)

      const snapshot = await fetchViaSnapshot()
      if (cancelled) return

      if (snapshot) {
        const todayDowFast = (today.getDay() + 6) % 7
        const closedFast = closedDays.includes(todayDowFast) || snapshot.isClosed
          ? (snapshot.closureReason || true)
          : false
        // Nobody's on site on a closed day, so cleaning tasks never nag as
        // overdue then — the RPC has no idea about closedDays/venue_closures,
        // it just counts "last done longer ago than the frequency allows".
        // Same rule as the fallback path below and useCleaningTasks.ts.
        const gatedSummary = closedFast ? { ...snapshot.summary, overdueClean: 0 } : snapshot.summary
        cacheSet(key, gatedSummary, closedFast)
        setSummary(gatedSummary)
        setClosedToday(closedFast)
        setLoading(false)
        revalidating.current = false
        return
      }

      // ── Fallback path: pre-095 databases ────────────────────────────────
      // Kept so the frontend can ship before the migration is applied — the
      // RPC 404s, fetchViaSnapshot returns null, and we land here.
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
        // Not gated by due() — see the comment on checksToday in fetchViaSnapshot.
        supabase.from('opening_closing_completions')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId).eq('session_type', 'opening').gte('completed_at', dayStart).lte('completed_at', dayEnd),
        supabase.from('opening_closing_completions')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId).eq('session_type', 'closing').gte('completed_at', dayStart).lte('completed_at', dayEnd),
        due('fridge_checks')
          ? supabase.from('fridges').select('id, check_days, required_periods').eq('venue_id', venueId).eq('is_active', true)
          : { data: [] },
        due('fridge_checks')
          ? supabase.from('fridge_temperature_logs').select('fridge_id, check_period').eq('venue_id', venueId).gte('logged_at', dayStart).lte('logged_at', dayEnd)
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

      // ── Closed today? Trading closure (weekly closedDays or a one-off
      // venue_closures entry) doesn't blank out checks that have their own
      // action_schedule (fridge, cooking, etc.): staff can be scheduled to
      // record those on a day the venue isn't open to customers. Cleaning
      // is the exception — nobody's on site to do it, so overdue cleaning
      // tasks don't nag on a closed day (see the overdueCount block below,
      // and useCleaningTasks.ts for the same rule on the Cleaning page).
      const todayDow = (today.getDay() + 6) % 7
      const closureReason = closures.data?.[0]?.reason
      const closedToday = closedDays.includes(todayDow) || !!closures.data?.length
        ? (closureReason || true)
        : false

      // ── Cleaning overdue count (no extra round-trip needed) ──────────────
      // Nobody's on site on a closed day, so cleaning tasks never nag as
      // overdue then — see the closedToday comment above.
      let overdueCount = 0
      if (!closedToday && due('cleaning_tasks') && cleaning.data?.length) {
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

      const loggedPeriodsByFridge = new Map()
      for (const l of (fridgeLogs.data ?? [])) {
        if (!loggedPeriodsByFridge.has(l.fridge_id)) loggedPeriodsByFridge.set(l.fridge_id, new Set())
        loggedPeriodsByFridge.get(l.fridge_id).add(l.check_period)
      }
      const uncheckedFridges = (fridges.data ?? []).filter(f => {
        const logged = loggedPeriodsByFridge.get(f.id) ?? new Set()
        return ['am', 'pm'].some(period => isCheckRequired(f, today, period) && !logged.has(period))
      }).length
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
      cacheSet(key, fresh, closedToday)
      setSummary(fresh)
      setClosedToday(closedToday)
      setLoading(false)
      revalidating.current = false
      } catch (err) {
        // Report it. This catch is why a TypeError in the fetch path went
        // unnoticed for so long: falling back to emptySummary() renders as
        // "0 overdue cleans, 0 fridges due", which reads as a compliant venue
        // rather than as a broken screen. Nobody can report what looks fine.
        captureSilent(err, 'useTodaySummary:fetch')
        if (!cancelled) {
          if (!entry) { setSummary(emptySummary()); setLoading(false) }
          revalidating.current = false
        }
      }
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, closedDays.join(','), todayStr, gating, refreshTick])

  return { summary, loading, closedToday }
}
