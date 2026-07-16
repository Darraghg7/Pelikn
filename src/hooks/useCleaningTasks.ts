import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchCleaningTasks, type CleaningTask, type CleaningCompletion } from '../lib/api/cleaning'

const FREQ_DAYS: Record<string, number> = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }

function calendarDaysBetween(a: Date, b: Date): number {
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((bDay.getTime() - aDay.getTime()) / 86400000)
}

export type CleaningStatus = 'done' | 'due_soon' | 'overdue'

export function cleaningStatus(task: CleaningTask, lastCompletion: CleaningCompletion | null): CleaningStatus {
  if (!lastCompletion) return 'overdue'
  const completedAt = new Date(lastCompletion.completed_at)
  const now = new Date()

  if (task.frequency === 'daily' || !FREQ_DAYS[task.frequency]) {
    const daysAgo = calendarDaysBetween(completedAt, now)
    if (daysAgo <= 0) return 'done'
    return 'overdue'
  }

  const daysSince = (now.getTime() - completedAt.getTime()) / 86400000
  const threshold = FREQ_DAYS[task.frequency]
  if (daysSince <= threshold * 0.8) return 'done'
  if (daysSince <= threshold)       return 'due_soon'
  return 'overdue'
}

export function useCleaningTasks(jobRole: string | null = null): {
  tasks: (CleaningTask & { lastCompletion: CleaningCompletion | null; status: CleaningStatus })[]
  loading: boolean
  reload: () => void
  overdueCount: number
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cleaningTasks', venueId],
    queryFn: () => fetchCleaningTasks(venueId!),
    enabled: !!venueId,
  })

  const tasks: CleaningTask[] = data?.tasks ?? []
  const completions: CleaningCompletion[] = data?.completions ?? []

  let filtered = tasks
  if (jobRole) {
    filtered = filtered.filter((t) => t.assigned_role === jobRole || t.assigned_role === 'all')
  }

  const enriched = filtered.map((t) => {
    const last = completions.find((c) => c.cleaning_task_id === t.id) ?? null
    return { ...t, lastCompletion: last, status: cleaningStatus(t, last) }
  })

  const overdueCount = enriched.filter((t) => t.status === 'overdue').length

  return { tasks: enriched, loading: isLoading, reload: refetch, overdueCount }
}
