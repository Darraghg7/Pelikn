import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { format } from 'date-fns'
import { fetchTasksForRole, fetchAllTasks } from '../lib/api/tasks'
import { roleMatcher } from '../lib/roleFilter'
import { readPersisted, writePersisted } from '../lib/persistedCache'
import type { TaskTemplate, TaskOneOff, TaskCompletion } from '../types'

export function useTasksForRole(viewerRoleIds: readonly string[] | null, staffId: string, knownRoleIds: readonly string[] = []): {
  templates: TaskTemplate[]
  oneOffs: TaskOneOff[]
  completions: TaskCompletion[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tasksForRole', venueId, staffId, today],
    queryFn: () => fetchTasksForRole(venueId!, today),
    enabled: !!venueId,
  })

  const rawTemplates: TaskTemplate[] = (data as { templates?: TaskTemplate[] })?.templates ?? []
  const rawOneOffs: TaskOneOff[] = (data as { oneOffs?: TaskOneOff[] })?.oneOffs ?? []
  const completions: TaskCompletion[] = (data as { completions?: TaskCompletion[] })?.completions ?? []

  const matchesRole = roleMatcher(viewerRoleIds, knownRoleIds)

  const templates = rawTemplates.filter((t) => matchesRole(t.role_id))

  const allOneOffs = rawOneOffs.filter(
    (o) => matchesRole(o.role_id) || (!!staffId && o.assigned_to_staff_id === staffId)
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

  // Last result is kept on disk and shown on the next cold open while the
  // fresh one loads, so the Tasks tab isn't a skeleton on every visit.
  const persistKey = `${venueId}|${dateStr}`
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['allTasks', venueId, dateStr],
    queryFn: async () => {
      const result = await fetchAllTasks(venueId!, dateStr)
      writePersisted('allTasks', persistKey, result)
      return result
    },
    placeholderData: () => readPersisted('allTasks', persistKey) ?? undefined,
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
