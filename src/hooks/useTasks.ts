import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { format } from 'date-fns'
import { fetchTasksForRole, fetchAllTasks } from '../lib/api/tasks'
import type { TaskTemplate, TaskOneOff, TaskCompletion } from '../types'

export function useTasksForRole(jobRole: string, staffId: string): {
  templates: TaskTemplate[]
  oneOffs: TaskOneOff[]
  completions: TaskCompletion[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tasksForRole', venueId, jobRole, staffId, today],
    queryFn: () => fetchTasksForRole(venueId, today),
    enabled: !!venueId,
  })

  const rawTemplates: TaskTemplate[] = (data as { templates?: TaskTemplate[] })?.templates ?? []
  const rawOneOffs: TaskOneOff[] = (data as { oneOffs?: TaskOneOff[] })?.oneOffs ?? []
  const completions: TaskCompletion[] = (data as { completions?: TaskCompletion[] })?.completions ?? []

  const templates = rawTemplates.filter(
    (t) => t.job_role === jobRole || t.job_role === 'all'
  )

  const allOneOffs = rawOneOffs.filter(
    (o) =>
      o.job_role === jobRole ||
      o.job_role === 'all' ||
      (staffId && o.assigned_to_staff_id === staffId)
  )

  const seen = new Set<string>()
  const oneOffs = allOneOffs.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })

  return { templates, oneOffs, completions, loading: isLoading, reload: refetch }
}

export function useAllTasks(selectedDate?: Date | null): {
  templates: TaskTemplate[]
  oneOffs: TaskOneOff[]
  completions: TaskCompletion[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['allTasks', venueId, dateStr],
    queryFn: () => fetchAllTasks(venueId, dateStr),
    enabled: !!venueId,
  })

  return {
    templates: ((data as { templates?: TaskTemplate[] })?.templates ?? []),
    oneOffs: ((data as { oneOffs?: TaskOneOff[] })?.oneOffs ?? []),
    completions: ((data as { completions?: TaskCompletion[] })?.completions ?? []),
    loading: isLoading,
    reload: refetch,
  }
}
