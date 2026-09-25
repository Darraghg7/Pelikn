import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { londonToday } from '../lib/time'
import { takeBootstrap } from '../lib/api/bootstrap'

export interface ClosingDepartmentStatus {
  departmentId: string
  departmentName: string
  totalChecks: number
  doneChecks: number
  isComplete: boolean
  /** True once this person is clear to clock out for this department — either
   *  they personally logged at least one of today's closing checks, or they've
   *  already tapped Accept. False while blocked (checklist incomplete, or
   *  complete but this person hasn't signed off on someone else's work). */
  cleared: boolean
}

/**
 * Resolves whether `staffId` is on the hook for a closing checklist today,
 * for every department their roles cover, and what state each is in.
 *
 * "Cleared" deliberately isn't the same as "did nothing" — a person who
 * personally ticked off at least one of today's closing checks has already
 * put their name to it, so they don't also have to tap Accept. That's not
 * just the first closer: if three people each ticked a few items through the
 * evening, all three are cleared without an extra step, and only someone who
 * closes without having touched the checklist at all needs to accept.
 */
export function useClosingGate(staffId: string | null | undefined) {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const today = londonToday()

  const queryKey = ['closingGate', venueId, staffId, today]

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ClosingDepartmentStatus[]> => {
      if (!staffId || !venueId) return []

      // First load's opening pair comes from the startup bundle when it's
      // available (126) — for most people, on most days, that's the whole
      // answer: not closing today, so nothing further is fetched.
      const boot = await takeBootstrap(venueId, 'closingGate', staffId)
      const [{ data: shiftRows }, { data: roleRows }] = boot
        ? [{ data: boot.closing_shifts }, { data: boot.my_role_ids }]
        : await Promise.all([
          supabase.from('shifts').select('is_closing').eq('venue_id', venueId).eq('staff_id', staffId).eq('shift_date', today),
          supabase.from('staff_role_assignments').select('role_id').eq('staff_id', staffId),
        ])

      const isClosingToday = (shiftRows ?? []).some((s) => s.is_closing)
      if (!isClosingToday || !roleRows?.length) return []

      const roleIds = roleRows.map((r) => r.role_id)
      const { data: venueRoleRows } = await supabase
        .from('venue_roles')
        .select('department_id, departments(id, name)')
        .in('id', roleIds)
        .not('department_id', 'is', null)

      const departmentsById = new Map<string, string>()
      for (const r of venueRoleRows ?? []) {
        const dept = (r as unknown as { departments?: { id: string; name: string } | null }).departments
        if (dept) departmentsById.set(dept.id, dept.name)
      }
      if (departmentsById.size === 0) return []

      const departmentIds = [...departmentsById.keys()]

      const [{ data: checks }, { data: myAcceptances }] = await Promise.all([
        supabase
          .from('opening_closing_checks')
          .select('id, department_id')
          .eq('venue_id', venueId)
          .eq('type', 'closing')
          .eq('is_active', true)
          .in('department_id', departmentIds),
        supabase
          .from('closing_acceptances')
          .select('department_id')
          .eq('venue_id', venueId)
          .eq('session_date', today)
          .eq('staff_id', staffId),
      ])

      const checkIds = (checks ?? []).map((c) => c.id)
      const { data: completions } = checkIds.length
        ? await supabase
            .from('opening_closing_completions')
            .select('check_id, staff_id')
            .eq('venue_id', venueId)
            .eq('session_date', today)
            .eq('session_type', 'closing')
            .in('check_id', checkIds)
        : { data: [] as { check_id: string; staff_id: string | null }[] }

      const acceptedDeptIds = new Set((myAcceptances ?? []).map((a) => a.department_id))
      const doneCheckIds = new Set((completions ?? []).map((c) => c.check_id))

      return departmentIds.map((deptId) => {
        const deptChecks = (checks ?? []).filter((c) => c.department_id === deptId)
        const doneCount = deptChecks.filter((c) => doneCheckIds.has(c.id)).length
        const isComplete = deptChecks.length === 0 || doneCount === deptChecks.length
        const selfContributed = (completions ?? []).some(
          (c) => c.staff_id === staffId && deptChecks.some((dc) => dc.id === c.check_id),
        )
        return {
          departmentId: deptId,
          departmentName: departmentsById.get(deptId) ?? '',
          totalChecks: deptChecks.length,
          doneChecks: doneCount,
          isComplete,
          cleared: isComplete && (selfContributed || acceptedDeptIds.has(deptId)),
        }
      })
    },
    enabled: !!staffId && !!venueId,
    staleTime: 30_000,
  })

  const departments = data ?? []
  const blocked = departments.some((d) => !d.cleared)

  const accept = useCallback(
    async (token: string, venueSlug: string, departmentId: string) => {
      const { error } = await supabase.rpc('accept_closing_checklist', {
        p_token: token,
        p_venue_slug: venueSlug,
        p_department_id: departmentId,
        p_session_date: today,
      })
      if (!error) queryClient.invalidateQueries({ queryKey })
      return { error }
    },
    [today, queryClient, queryKey],
  )

  return { loading: isLoading, departments, blocked, accept, reload: refetch }
}
