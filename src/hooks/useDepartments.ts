import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useSession } from '../contexts/SessionContext'

export interface Department {
  id: string
  name: string
  sort_order: number
  venue_id: string
}

/**
 * Departments are where people work (Kitchen, Front of House…). People are
 * ticked into them directly (staff_departments), and cleaning tasks, Tasks
 * and checks are assigned to one. Someone in no department sees every
 * department — see roleFilter.ts's fail-open rule.
 */
export function useDepartments(): {
  departments: Department[]
  loading: boolean
  reload: () => void
  addDepartment: (name: string) => Promise<{ error: unknown }>
  renameDepartment: (id: string, name: string) => Promise<{ error: unknown }>
  deleteDepartment: (id: string) => Promise<{ error: unknown }>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const { data: departments = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['departments', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('departments')
        .select('id, name, sort_order, venue_id')
        .eq('venue_id', venueId)
        .order('sort_order')
        .order('name')
      return (data ?? []) as Department[]
    },
    enabled: !!venueId,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments', venueId] })

  const addDepartment = async (name: string) => {
    const { error } = await supabase.from('departments').insert({
      venue_id:   venueId,
      name:       name.trim(),
      sort_order: departments.length,
    })
    if (!error) invalidate()
    return { error }
  }

  const renameDepartment = async (id: string, name: string) => {
    const { error } = await supabase.from('departments').update({ name: name.trim() }).eq('id', id)
    if (!error) invalidate()
    return { error }
  }

  const deleteDepartment = async (id: string) => {
    // Checks, cleaning tasks and Tasks go to NULL via FK (fail-open — visible
    // to everyone) rather than cascading; people just leave the department.
    const { error } = await supabase.from('departments').delete().eq('id', id)
    if (!error) {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['staff_departments'] })
    }
    return { error }
  }

  return { departments, loading, reload: refetch, addDepartment, renameDepartment, deleteDepartment }
}


// ── Person ↔ departments ──────────────────────────────────────────────────────

export function useStaffDepartments(staffId: string | null | undefined): {
  departmentIds: string[]
  loading: boolean
  toggleDepartment: (departmentId: string) => Promise<{ error: unknown }>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['staff_departments', venueId, staffId]

  const { data: departmentIds = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_departments')
        .select('department_id')
        .eq('staff_id', staffId)
        .eq('venue_id', venueId)
      if (error) throw error
      return (data ?? []).map((r) => (r as { department_id: string }).department_id)
    },
    enabled: !!venueId && !!staffId,
  })

  const toggleDepartment = async (departmentId: string) => {
    const { error } = departmentIds.includes(departmentId)
      ? await supabase.from('staff_departments')
          .delete().eq('staff_id', staffId).eq('department_id', departmentId)
      : await supabase.from('staff_departments')
          .insert({ staff_id: staffId, department_id: departmentId, venue_id: venueId })
    queryClient.invalidateQueries({ queryKey })
    return { error }
  }

  return { departmentIds, loading, toggleDepartment }
}

// ── What the signed-in person sees ────────────────────────────────────────────

const ALL = 'all'
const filterKey = (venueId: string | null) => `pelikn_dept_filter_${venueId}`

function readFilter(venueId: string | null): string | null {
  try { return localStorage.getItem(filterKey(venueId)) } catch { return null }
}

/**
 * Which departments' cleaning, Tasks and checks the signed-in person sees.
 * Feed viewerDepartmentIds and knownDepartmentIds into departmentMatcher.
 *
 * Staff see the departments they're in (none = everything). Managers can
 * look at any one department or all of them: they open on their own
 * department when they're in exactly one (a kitchen manager lands on
 * Kitchen), otherwise on All. Their pick is remembered per venue.
 */
export function useViewerDepartments(): {
  departments: Department[]
  viewerDepartmentIds: string[] | null
  knownDepartmentIds: string[]
  departmentName: (id: string | null | undefined) => string | null
  /** Managers only: 'all' or a department id. */
  filter: string
  setFilter: (value: string) => void
  /** The department new items should default to — the one being viewed. */
  defaultDepartmentId: string | null
} {
  const { venueId } = useVenue()
  const { session, isManager } = (useSession() ?? {}) as {
    session?: { staffId?: string } | null
    isManager?: boolean
  }
  const { departments } = useDepartments()
  const { departmentIds: mine } = useStaffDepartments(session?.staffId)
  const [picked, setPicked] = useState<string | null>(() => readFilter(venueId))

  const knownDepartmentIds = useMemo(() => departments.map((d) => d.id), [departments])
  const departmentName = (id: string | null | undefined) =>
    departments.find((d) => d.id === id)?.name ?? null

  // A remembered pick for a department that's since been removed falls back.
  const ownDefault = mine.length === 1 ? mine[0] : ALL
  const filter = picked === ALL || (picked && knownDepartmentIds.includes(picked)) ? picked : ownDefault

  const setFilter = (value: string) => {
    setPicked(value)
    try { localStorage.setItem(filterKey(venueId), value) } catch { /* private mode */ }
  }

  const viewerDepartmentIds = isManager ? (filter === ALL ? null : [filter]) : mine
  const defaultDepartmentId = isManager
    ? (filter === ALL ? null : filter)
    : (mine.length === 1 ? mine[0] : null)

  return { departments, viewerDepartmentIds, knownDepartmentIds, departmentName, filter, setFilter, defaultDepartmentId }
}
