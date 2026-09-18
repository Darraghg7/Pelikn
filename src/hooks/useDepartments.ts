import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export interface Department {
  id: string
  name: string
  sort_order: number
  venue_id: string
}

/**
 * Departments group venue_roles for check/task visibility and the closing
 * checklist. A role with no department, or a department with no roles, is
 * never a blocker — see roleFilter.ts's fail-open rule.
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
    // venue_roles.department_id and opening_closing_checks.department_id
    // both go to NULL via FK (fail-open) rather than cascading.
    const { error } = await supabase.from('departments').delete().eq('id', id)
    if (!error) {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['venue_roles', venueId] })
    }
    return { error }
  }

  return { departments, loading, reload: refetch, addDepartment, renameDepartment, deleteDepartment }
}
