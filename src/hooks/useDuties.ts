import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useSession } from '../contexts/SessionContext'

interface DutyTemplateItem {
  id: string
  title: string
  sort_order: number
  completed?: boolean
}

interface DutyTemplate {
  id: string
  title: string
  created_at: string
  items?: DutyTemplateItem[]
}

interface DutyAssignment {
  assignmentId: string
  templateId: string
  title: string
  items: DutyTemplateItem[]
}

interface AllTodayDuty {
  assignmentId: string
  staffName: string
  title: string
  total: number
  completed: number
}

interface ShiftDutyAssignment {
  id: string
  duty_template_id: string
}

// All active templates with their items — used in Settings and Rota picker
export function useDutyTemplates(): {
  templates: DutyTemplate[]
  loading: boolean
  reload: () => void
  addTemplate: (title: string, itemTitles: string[]) => Promise<{ error: unknown }>
  deleteTemplate: (id: string) => Promise<{ error: unknown }>
  updateItems: (templateId: string, itemTitles: string[]) => Promise<void>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dutyTemplates', venueId],
    queryFn: async () => {
      if (!venueId) return [] as DutyTemplate[]
      const { data: tmpl } = await supabase
        .from('duty_templates')
        .select('id, title, created_at')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (!tmpl?.length) return [] as DutyTemplate[]

      const { data: items } = await supabase
        .from('duty_template_items')
        .select('id, duty_template_id, title, sort_order')
        .in('duty_template_id', tmpl.map(t => t.id))
        .order('sort_order', { ascending: true })

      const itemsByTemplate = (items ?? []).reduce<Record<string, DutyTemplateItem[]>>((acc, item) => {
        ;(acc[item.duty_template_id] ??= []).push(item as DutyTemplateItem)
        return acc
      }, {})

      return tmpl.map(t => ({ ...t, items: itemsByTemplate[t.id] ?? [] })) as DutyTemplate[]
    },
    enabled: !!venueId,
  })

  const addTemplate = useCallback(async (title: string, itemTitles: string[]) => {
    const { data: tmpl, error } = await supabase
      .from('duty_templates')
      .insert({ venue_id: venueId, title: title.trim() })
      .select('id')
      .single()
    if (error) return { error }
    if (itemTitles.length) {
      const rows = itemTitles
        .filter(t => t.trim())
        .map((t, i) => ({ duty_template_id: (tmpl as { id: string }).id, title: t.trim(), sort_order: i }))
      if (rows.length) await supabase.from('duty_template_items').insert(rows)
    }
    await refetch()
    return { error: null }
  }, [venueId, refetch])

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('duty_templates')
      .update({ is_active: false })
      .eq('id', id)
    if (!error) await refetch()
    return { error }
  }, [refetch])

  const updateItems = useCallback(async (templateId: string, itemTitles: string[]) => {
    await supabase.from('duty_template_items').delete().eq('duty_template_id', templateId)
    const rows = itemTitles
      .filter(t => t.trim())
      .map((t, i) => ({ duty_template_id: templateId, title: t.trim(), sort_order: i }))
    if (rows.length) await supabase.from('duty_template_items').insert(rows)
    await refetch()
  }, [refetch])

  return { templates: data ?? [], loading: isLoading, reload: refetch, addTemplate, deleteTemplate, updateItems }
}

// Duties assigned to a specific staff member today, with completions
export function useTodayDuties(staffId: string): {
  duties: DutyAssignment[]
  loading: boolean
  reload: () => void
  toggleItem: (assignmentId: string, itemId: string, currentlyDone: boolean) => Promise<{ error: unknown }>
} {
  const { venueId, venueSlug } = useVenue()
  // SessionContext is untyped .jsx (its inferred type is null) — shape the one field we use.
  const { session } = (useSession() ?? {}) as { session?: { token?: string } | null }
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['todayDuties', venueId, staffId],
    queryFn: async (): Promise<DutyAssignment[]> => {
      if (!venueId || !staffId) return []
      const todayStr = format(new Date(), 'yyyy-MM-dd')

      // Find shifts for this staff member today, then their duty assignments
      const { data: shifts } = await supabase
        .from('shifts')
        .select('id')
        .eq('venue_id', venueId)
        .eq('staff_id', staffId)
        .eq('shift_date', todayStr)

      if (!shifts?.length) return []

      const shiftIds = shifts.map(s => (s as { id: string }).id)
      const { data: assignments } = await supabase
        .from('duty_assignments')
        .select(`
          id,
          shift_id,
          duty_template_id,
          duty_templates ( id, title ),
          duty_template_items ( id, title, sort_order )
        `)
        .in('shift_id', shiftIds)

      if (!assignments?.length) return []

      // Fetch completions for these assignments
      const assignmentIds = assignments.map(a => (a as { id: string }).id)
      const { data: completions } = await supabase
        .from('duty_item_completions')
        .select('duty_assignment_id, duty_template_item_id')
        .in('duty_assignment_id', assignmentIds)

      const completedSet = new Set(
        (completions ?? []).map(c => `${(c as { duty_assignment_id: string; duty_template_item_id: string }).duty_assignment_id}:${(c as { duty_assignment_id: string; duty_template_item_id: string }).duty_template_item_id}`)
      )

      return assignments.map(a => {
        // PostgREST returns to-one joins as objects; the untyped client infers arrays.
        const aTyped = a as unknown as {
          id: string
          duty_template_id: string
          duty_templates?: { title: string } | null
          duty_template_items?: DutyTemplateItem[]
        }
        const items = (aTyped.duty_template_items ?? [])
          .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
          .map(item => ({
            ...item,
            completed: completedSet.has(`${aTyped.id}:${item.id}`),
          }))
        return {
          assignmentId: aTyped.id,
          templateId:   aTyped.duty_template_id,
          title:        aTyped.duty_templates?.title ?? '',
          items,
        }
      })
    },
    enabled: !!venueId && !!staffId,
  })

  const toggleItem = useCallback(async (assignmentId: string, itemId: string, currentlyDone: boolean) => {
    const fn = currentlyDone ? 'uncomplete_duty_item' : 'complete_duty_item'
    // Optimistic update
    queryClient.setQueryData(['todayDuties', venueId, staffId], (prev: DutyAssignment[] | undefined) =>
      (prev ?? []).map(duty => duty.assignmentId === assignmentId
        ? {
            ...duty,
            items: duty.items.map(item => item.id === itemId
              ? { ...item, completed: !currentlyDone }
              : item),
          }
        : duty)
    )
    const { error } = await supabase.rpc(fn, {
      p_token:         session?.token,
      p_venue_slug:    venueSlug,
      p_assignment_id: assignmentId,
      p_item_id:       itemId,
    })
    if (error) {
      // Revert optimistic update
      queryClient.setQueryData(['todayDuties', venueId, staffId], (prev: DutyAssignment[] | undefined) =>
        (prev ?? []).map(duty => duty.assignmentId === assignmentId
          ? {
              ...duty,
              items: duty.items.map(item => item.id === itemId
                ? { ...item, completed: currentlyDone }
                : item),
            }
          : duty)
      )
      return { error }
    }
    await refetch()
    return { error }
  }, [session, venueSlug, venueId, staffId, queryClient, refetch])

  return { duties: data ?? [], loading: isLoading, reload: refetch, toggleItem }
}

// All duty assignments for today — manager overview
export function useAllTodayDuties(): { duties: AllTodayDuty[]; loading: boolean } {
  const { venueId } = useVenue()

  const { data, isLoading } = useQuery({
    queryKey: ['allTodayDuties', venueId],
    queryFn: async (): Promise<AllTodayDuty[]> => {
      if (!venueId) return []
      const todayStr = format(new Date(), 'yyyy-MM-dd')

      const { data: shifts } = await supabase
        .from('shifts')
        .select('id, staff_id, staff ( name )')
        .eq('venue_id', venueId)
        .eq('shift_date', todayStr)

      if (!shifts?.length) return []

      const shiftIds = shifts.map(s => (s as { id: string }).id)
      const staffById = Object.fromEntries(shifts.map(s => {
        const st = s as unknown as { id: string; staff?: { name: string } | null }
        return [st.id, st.staff]
      }))

      const { data: assignments } = await supabase
        .from('duty_assignments')
        .select(`
          id, shift_id,
          duty_templates ( title ),
          duty_template_items ( id )
        `)
        .in('shift_id', shiftIds)

      if (!assignments?.length) return []

      const assignmentIds = assignments.map(a => (a as { id: string }).id)
      const { data: completions } = await supabase
        .from('duty_item_completions')
        .select('duty_assignment_id')
        .in('duty_assignment_id', assignmentIds)

      const completedByAssignment = (completions ?? []).reduce<Record<string, number>>((acc, c) => {
        const id = (c as { duty_assignment_id: string }).duty_assignment_id
        acc[id] = (acc[id] ?? 0) + 1
        return acc
      }, {})

      return assignments.map(a => {
        const aTyped = a as unknown as {
          id: string
          shift_id: string
          duty_templates?: { title: string } | null
          duty_template_items?: unknown[]
        }
        return {
          assignmentId: aTyped.id,
          staffName:    (staffById[aTyped.shift_id] as { name: string } | null)?.name ?? '-',
          title:        aTyped.duty_templates?.title ?? '',
          total:        aTyped.duty_template_items?.length ?? 0,
          completed:    completedByAssignment[aTyped.id] ?? 0,
        }
      })
    },
    enabled: !!venueId,
  })

  return { duties: data ?? [], loading: isLoading }
}

// Duty assignment for a specific shift (used in Rota modal to pre-populate)
export function useShiftDuty(shiftId: string): { assignment: ShiftDutyAssignment | null; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['shiftDuty', shiftId],
    queryFn: async () => {
      const { data } = await supabase
        .from('duty_assignments')
        .select('id, duty_template_id')
        .eq('shift_id', shiftId)
        .maybeSingle()
      return (data ?? null) as ShiftDutyAssignment | null
    },
    enabled: !!shiftId,
  })

  return { assignment: data ?? null, loading: isLoading }
}
