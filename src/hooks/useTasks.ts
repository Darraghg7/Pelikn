import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { format } from 'date-fns'
import { fetchTasksForRole, fetchAllTasks } from '../lib/api/tasks'
import { roleMatcher } from '../lib/roleFilter'
import type { TaskTemplate, TaskOneOff, TaskCompletion } from '../types'

export function useTasksForRole(jobRole: string, staffId: string, knownRoles: readonly string[] = []): {
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
    queryFn: () => fetchTasksForRole(venueId!, today),
    enabled: !!venueId,
  })

  const rawTemplates: TaskTemplate[] = (data as { templates?: TaskTemplate[] })?.templates ?? []
  const rawOneOffs: TaskOneOff[] = (data as { oneOffs?: TaskOneOff[] })?.oneOffs ?? []
  const completions: TaskCompletion[] = (data as { completions?: TaskCompletion[] })?.completions ?? []

  const matchesRole = roleMatcher(jobRole, knownRoles)

  const templates = rawTemplates.filter((t) => matchesRole(t.job_role))

  const allOneOffs = rawOneOffs.filter(
    (o) => matchesRole(o.job_role) || (!!staffId && o.assigned_to_staff_id === staffId)
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
    queryFn: () => fetchAllTasks(venueId!, dateStr),
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
