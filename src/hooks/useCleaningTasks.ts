import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { useAppSettings } from './useSettings'
import useVenueClosures from './useVenueClosures'
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
  if (!lastCompletion) return 'overdue'
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

export function useCleaningTasks(
  jobRole: string | null = null,
  knownRoles: readonly string[] = [],
  asOf?: Date,
): {
  tasks: (CleaningTask & { lastCompletion: CleaningCompletion | null; status: CleaningStatus })[]
  loading: boolean
  error: unknown
  reload: () => void
  overdueCount: number
} {
  const { venueId } = useVenue()
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

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['cleaningTasks', venueId],
    queryFn: () => fetchCleaningTasks(venueId!),
    enabled: !!venueId,
  })

  const tasks: CleaningTask[] = data?.tasks ?? []
  const completions: CleaningCompletion[] = data?.completions ?? []

  const matchesRole = roleMatcher(jobRole, knownRoles)
  const filtered = tasks.filter((t) => matchesRole(t.assigned_role))

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
    return { ...t, lastCompletion: last, status }
  })

  const overdueCount = enriched.filter((t) => t.status === 'overdue').length

  return { tasks: enriched, loading: isLoading, error, reload: refetch, overdueCount }
}
