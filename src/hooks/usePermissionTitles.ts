import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export interface PermissionTitle {
  id: string
  label: string
  permissions: string[]
  sort_order: number
  venue_id: string
}

export interface PermissionTitleDraft {
  id: string
  label: string
  permissions: string[]
}

/**
 * Permission titles (e.g. "Supervisor") — a named, assignable bundle of
 * staff_permissions ids. Staff hold a live reference (staff.permission_title_id),
 * not a copy: editing a title here changes everyone currently assigned it.
 * Only meaningful for staff.role = 'staff' — Owner/Manager stay fixed tiers.
 */
export function usePermissionTitles(): {
  titles: PermissionTitle[]
  loading: boolean
  reload: () => void
  saveTitles: (draft: PermissionTitleDraft[]) => Promise<{ error: unknown }>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['permission_titles', venueId]

  const { data: titles = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('permission_titles')
        .select('id, label, permissions, sort_order, venue_id')
        .eq('venue_id', venueId)
        .order('sort_order')
        .order('label')
      return (data ?? []) as PermissionTitle[]
    },
    enabled: !!venueId,
  })

  // Reconciles against the currently-loaded rows rather than delete-then-
  // recreate everything — a title a staff member references must be updated
  // in place, not dropped and reinserted under a new id, or that reference
  // (and their permissions) silently disappears.
  const saveTitles = async (draft: PermissionTitleDraft[]) => {
    const existingIds = new Set(titles.map((t) => t.id))
    const draftIds = new Set(draft.map((d) => d.id))

    const toInsert = draft.filter((d) => !existingIds.has(d.id))
    const toDeleteIds = titles.filter((t) => !draftIds.has(t.id)).map((t) => t.id)

    for (const [index, d] of draft.entries()) {
      if (existingIds.has(d.id)) {
        const { error } = await supabase
          .from('permission_titles')
          .update({ label: d.label, permissions: d.permissions, sort_order: index })
          .eq('id', d.id)
        if (error) return { error }
      }
    }

    if (toInsert.length) {
      const { error } = await supabase.from('permission_titles').insert(
        toInsert.map((d) => ({
          venue_id: venueId,
          label: d.label,
          permissions: d.permissions,
          sort_order: draft.findIndex((x) => x.id === d.id),
        })),
      )
      if (error) return { error }
    }

    if (toDeleteIds.length) {
      const { error } = await supabase.from('permission_titles').delete().in('id', toDeleteIds)
      if (error) return { error }
    }

    queryClient.invalidateQueries({ queryKey })
    return { error: null }
  }

  return { titles, loading, reload: refetch, saveTitles }
}
