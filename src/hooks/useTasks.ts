import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { format } from 'date-fns'
import { fetchAllTasks } from '../lib/api/tasks'
import { departmentMatcher } from '../lib/roleFilter'
import { readPersisted, writePersisted } from '../lib/persistedCache'
import type { TaskTemplate, TaskOneOff, TaskCompletion } from '../types'

/**
 * Tasks for one staff member on one day: recurring and one-off tasks for the
 * departments they're in (fail-open — see lib/roleFilter), plus one-offs
 * assigned to them by name. A one-off assigned to someone else is theirs
 * alone, whatever its department.
 */
export function useTasksForStaff(
  viewerDepartmentIds: readonly string[] | null,
  staffId: string | null | undefined,
  knownDepartmentIds: readonly string[] = [],
  date: Date = new Date(),
): {
  templates: TaskTemplate[]
  oneOffs: TaskOneOff[]
  completions: TaskCompletion[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['allTasks', venueId, dateStr],
    queryFn: () => fetchAllTasks(venueId!, dateStr),
    enabled: !!venueId,
  })

  const matchesDepartment = departmentMatcher(viewerDepartmentIds, knownDepartmentIds)
  const templates = (data?.templates ?? []).filter((t) => matchesDepartment(t.department_id))
  const oneOffs = (data?.oneOffs ?? []).filter((o) =>
    o.assigned_to_staff_id ? o.assigned_to_staff_id === staffId : matchesDepartment(o.department_id),
  )

  return { templates, oneOffs, completions: data?.completions ?? [], loading: isLoading, reload: refetch }
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
