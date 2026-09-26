import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfDay, endOfDay, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useViewerDepartments } from './useDepartments'
import { useCleaningTasks } from './useCleaningTasks'
import { isActionDueToday } from './useTodaySummary'
import { departmentMatcher } from '../lib/roleFilter'

interface Summary {
  overdueClean: number
  checksToday: number
  closingChecksToday: number
  totalChecks: number
  [key: string]: unknown
}

/**
 * The manager dashboard's department-assigned counts (overdue cleaning,
 * opening/closing checks) narrowed to the department the manager is viewing —
 * the same pick as on Cleaning / Tasks / Opening & Closing. On "All
 * departments" the venue-wide summary passes through untouched.
 *
 * Cleaning comes from useCleaningTasks, the source of truth for cleaning
 * status. Checks keep useTodaySummary's definitions (completions logged today
 * per session type; active checks for the total), filtered to the department.
 */
export function useDepartmentSummary<T extends Summary | null>(
  summary: T,
  actionSchedules: Record<string, unknown> = {},
): { summary: T; departmentName: string | null } {
  const { venueId } = useVenue()
  const { viewerDepartmentIds, knownDepartmentIds, departmentName, filter } = useViewerDepartments()
  const scoped = filter !== 'all' && !!viewerDepartmentIds?.length

  const cleaning = useCleaningTasks(viewerDepartmentIds, knownDepartmentIds, undefined, { enabled: scoped })

  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: checks } = useQuery({
    queryKey: ['departmentChecksToday', venueId, today],
    queryFn: async () => {
      const now = new Date()
      const [{ data: active, error: aErr }, { data: done, error: dErr }] = await Promise.all([
        supabase.from('opening_closing_checks')
          .select('id, department_id').eq('venue_id', venueId).eq('is_active', true),
        supabase.from('opening_closing_completions')
          .select('check_id, session_type').eq('venue_id', venueId)
          .gte('completed_at', startOfDay(now).toISOString())
          .lte('completed_at', endOfDay(now).toISOString()),
      ])
      if (aErr) throw aErr
      if (dErr) throw dErr
      return {
        active: (active ?? []) as { id: string; department_id: string | null }[],
        done:   (done ?? [])   as { check_id: string; session_type: string }[],
      }
    },
    enabled: !!venueId && scoped,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const cleaningDue = isActionDueToday('cleaning_tasks', actionSchedules)

  const result = useMemo(() => {
    if (!summary || !scoped) return summary
    const next = { ...summary }
    // A closed day or an unscheduled day already zeroed it venue-wide.
    if (summary.overdueClean !== 0 || cleaningDue) {
      next.overdueClean = cleaningDue ? cleaning.overdueCount : 0
    }
    if (checks) {
      const inScope = departmentMatcher(viewerDepartmentIds, knownDepartmentIds)
      const ids = new Set(checks.active.filter((c) => inScope(c.department_id)).map((c) => c.id))
      next.totalChecks        = ids.size
      next.checksToday        = checks.done.filter((c) => c.session_type === 'opening' && ids.has(c.check_id)).length
      next.closingChecksToday = checks.done.filter((c) => c.session_type === 'closing' && ids.has(c.check_id)).length
    }
    return next as T
  }, [summary, scoped, cleaningDue, cleaning.overdueCount, checks, viewerDepartmentIds, knownDepartmentIds])

  return { summary: result, departmentName: scoped ? departmentName(filter) : null }
}
