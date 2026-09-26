import { useEffect, useState } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useAppSettings } from './useSettings'
import useVenueClosures from './useVenueClosures'
import { useWidgetFetchGate } from './useWidgetFetchGate'
import { fetchCleaningTasks, type CleaningTask, type CleaningCompletion } from '../lib/api/cleaning'
import { roleMatcher } from '../lib/roleFilter'

const FREQ_DAYS: Record<string, number> = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }

function calendarDaysBetween(a: Date, b: Date): number {
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((bDay.getTime() - aDay.getTime()) / 86400000)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** closedDays is Monday-first (0=Mon..6=Sun) — see the same conversion in useTodaySummary.js. */
export function isVenueClosedOn(date: Date, closedDays: number[], closures: { start_date: string; end_date: string }[]): boolean {
  const dow = (date.getDay() + 6) % 7
  if (closedDays.includes(dow)) return true
  const dateStr = toDateStr(date)
  return closures.some(c => dateStr >= c.start_date && dateStr <= c.end_date)
}

export type CleaningStatus = 'done' | 'due_soon' | 'overdue'

/** `asOf` lets a caller ask "what was the state on this day" — defaults to now. */
export function cleaningStatus(
  task: CleaningTask,
  lastCompletion: CleaningCompletion | null,
  asOf: Date = new Date(),
): CleaningStatus {
  if (!lastCompletion) {
    // A task nobody has done yet gets its first cycle, counted from when it was
    // created, before it goes red — otherwise a weekly task added this morning
    // was "overdue" (and dragged the overdue count up) the moment it was saved.
    // Daily keeps the calendar-day rule: not done today means flagged.
    // Must match get_dashboard_snapshot's cleaning CTE (migration 130).
    const threshold = FREQ_DAYS[task.frequency]
    if (task.frequency !== 'daily' && threshold && task.created_at) {
      const daysSinceCreated = (asOf.getTime() - new Date(task.created_at).getTime()) / 86400000
      if (daysSinceCreated <= threshold) return 'due_soon'
    }
    return 'overdue'
  }
  const completedAt = new Date(lastCompletion.completed_at)

  if (task.frequency === 'daily' || !FREQ_DAYS[task.frequency]) {
    const daysAgo = calendarDaysBetween(completedAt, asOf)
    if (daysAgo <= 0) return 'done'
    return 'overdue'
  }

  const daysSince = (asOf.getTime() - completedAt.getTime()) / 86400000
  const threshold = FREQ_DAYS[task.frequency]
  if (daysSince <= threshold * 0.8) return 'done'
  if (daysSince <= threshold)       return 'due_soon'
  return 'overdue'
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface CleaningDueLabel {
  text: string
  tone: 'danger' | 'warning' | 'muted'
}

/**
 * "3d overdue" / "Due today" / "Due tomorrow" / "Due Fri" / "Due 12 Oct".
 * The due day follows the same model as cleaningStatus(): a daily task is due
 * the day after it was last done, anything else `threshold` days after.
 * Null when there's nothing useful to say — a closed day capped the status at
 * 'done' while the task itself is past due.
 */
export function cleaningDueLabel(
  task: CleaningTask,
  lastCompletion: CleaningCompletion | null,
  status: CleaningStatus,
  asOf: Date = new Date(),
): CleaningDueLabel | null {
  if (!lastCompletion) {
    if (status === 'overdue') return { text: 'Never done', tone: 'danger' }
    // Still in its first cycle (see cleaningStatus) — due one cycle after creation
    if (!task.created_at) return null
  }
  // Never-done tasks count from creation; `new` marks them in the label
  const isNew = !lastCompletion
  const from  = new Date(lastCompletion?.completed_at ?? (task.created_at as string))
  const dueAt = new Date(from)
  dueAt.setDate(dueAt.getDate() + (FREQ_DAYS[task.frequency] ?? 1))

  const daysPastDue = calendarDaysBetween(dueAt, asOf)
  if (status === 'done' && daysPastDue >= 0) return null
  if (daysPastDue > 0) return { text: `${daysPastDue}d overdue`, tone: 'danger' }
  const tone = status === 'due_soon' ? 'warning' : 'muted'
  const pre  = isNew ? 'New · d' : 'D'
  if (daysPastDue === 0) return { text: `${pre}ue today`, tone: 'warning' }
  if (daysPastDue === -1) return { text: `${pre}ue tomorrow`, tone }
  if (daysPastDue >= -6)  return { text: `${pre}ue ${WEEKDAYS[dueAt.getDay()]}`, tone }
  return { text: `${pre}ue ${dueAt.getDate()} ${MONTHS[dueAt.getMonth()]}`, tone }
}

// ── Live updates ────────────────────────────────────────────────────────────
// Staff tick tasks off on their own phones, so the manager's screen only learns
// about it from the server. Without this the cached list only refetched on a
// remount — a manager with /cleaning open on a tablet never saw a tick land.
// One channel per venue, shared by every mounted consumer (sidebar badge,
// page, widget), since they all read the same query.
const LIVE_TABLES = ['cleaning_completions', 'cleaning_tasks']
const POLL_WHEN_DOWN_MS = 60_000

const _live = {
  venueId: null as string | null,
  channel: null as ReturnType<typeof supabase.channel> | null,
  refs: 0,
  connected: false,
}

function teardownLive() {
  if (_live.channel) {
    try { supabase.removeChannel(_live.channel) } catch { /* already gone */ }
  }
  _live.venueId = null
  _live.channel = null
  _live.refs = 0
  _live.connected = false
}

function acquireLive(venueId: string, queryClient: QueryClient): () => void {
  if (_live.venueId !== venueId) teardownLive()
  _live.venueId = venueId
  _live.refs += 1

  if (!_live.channel) {
    try {
      const refresh = () => queryClient.invalidateQueries({ queryKey: ['cleaningTasks', venueId] })
      const channel = supabase.channel(`cleaning:${venueId}`)
      for (const table of LIVE_TABLES) {
        channel.on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table, filter: `venue_id=eq.${venueId}` },
          refresh,
        )
      }
      channel.subscribe((status: string) => { _live.connected = status === 'SUBSCRIBED' })
      _live.channel = channel
    } catch {
      // No realtime here — the poll below keeps the list current instead.
      _live.connected = false
    }
  }

  return () => {
    if (_live.venueId !== venueId) return
    _live.refs -= 1
    if (_live.refs <= 0) teardownLive()
  }
}

export function useCleaningTasks(
  viewerRoleIds: readonly string[] | null = null,
  knownRoleIds: readonly string[] = [],
  asOf?: Date,
  { enabled = true }: { enabled?: boolean } = {},
): {
  tasks: (CleaningTask & { lastCompletion: CleaningCompletion | null; status: CleaningStatus; due: CleaningDueLabel | null })[]
  loading: boolean
  error: unknown
  reload: () => void
  overdueCount: number
} {
  const { venueId } = useVenue()
  const gateOpen = useWidgetFetchGate()
  const { closedDays } = useAppSettings()
  const { closures } = useVenueClosures()

  // A tablet left open on this page never loses focus or remounts, so without
  // this tick a task completed yesterday would read 'done' forever — nothing
  // else forces a re-render to notice the calendar day (and so the due date)
  // has rolled over.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const active = !!venueId && gateOpen && enabled
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!active) return
    return acquireLive(venueId!, queryClient)
  }, [active, venueId, queryClient])

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['cleaningTasks', venueId],
    queryFn: () => fetchCleaningTasks(venueId!),
    enabled: active,
    // Realtime is the live path; this only kicks in while the channel is down.
    refetchInterval: () => (_live.connected ? false : POLL_WHEN_DOWN_MS),
    // A tablet woken from sleep has missed every event while it was suspended.
    refetchOnWindowFocus: true,
  })

  const tasks: CleaningTask[] = data?.tasks ?? []
  const completions: CleaningCompletion[] = data?.completions ?? []

  const matchesRole = roleMatcher(viewerRoleIds, knownRoleIds)
  const filtered = tasks.filter((t) => matchesRole(t.role_id))

  const reference = asOf ?? now
  // Completions logged after the day being viewed don't count towards it.
  const cutoff = new Date(
    reference.getFullYear(), reference.getMonth(), reference.getDate(), 23, 59, 59, 999,
  ).getTime()

  // The venue isn't open, so nothing should nag staff/managers to clean —
  // status is capped at 'done' rather than left as overdue/due_soon.
  const closedOnReference = isVenueClosedOn(reference, closedDays, closures)

  // completions arrive newest-first, so the first hit is the latest one.
  const enriched = filtered.map((t) => {
    const last = completions.find((c) =>
      c.cleaning_task_id === t.id && new Date(c.completed_at).getTime() <= cutoff
    ) ?? null
    const status = closedOnReference ? 'done' : cleaningStatus(t, last, reference)
    return { ...t, lastCompletion: last, status, due: cleaningDueLabel(t, last, status, reference) }
  })

  const overdueCount = enriched.filter((t) => t.status === 'overdue').length

  return { tasks: enriched, loading: isLoading, error, reload: refetch, overdueCount }
}
