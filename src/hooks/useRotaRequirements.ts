import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface RotaRequirement {
  id: string
  venue_id: string
  day_of_week: number
  sort_order?: number
  start_time?: string
  end_time?: string
  staff_count?: number
  venue_roles?: { id: string; name: string; color?: string } | null
  [key: string]: unknown
}

interface RequirementInput {
  day_of_week: number
  sort_order?: number
  start_time?: string
  end_time?: string
  staff_count?: number
  [key: string]: unknown
}

export function useRotaRequirements(): {
  requirements: RotaRequirement[]
  byDay: Record<number, RotaRequirement[]>
  totalSlots: number
  loading: boolean
  reload: () => void
  addRequirement: (req: RequirementInput) => Promise<{ error: unknown }>
  updateRequirement: (id: string, updates: Partial<RequirementInput>) => Promise<{ error: unknown }>
  deleteRequirement: (id: string) => Promise<{ error: unknown }>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['rota_requirements', venueId]

  const { data: requirements = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('rota_requirements')
        .select('*, venue_roles(id, name, color)')
        .eq('venue_id', venueId)
        .order('day_of_week')
        .order('sort_order')
        .order('start_time')
      return (data ?? []) as RotaRequirement[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  const addRequirement = async (req: RequirementInput) => {
    const { error } = await supabase.from('rota_requirements').insert({
      venue_id: venueId,
      ...req,
    })
    if (!error) queryClient.invalidateQueries({ queryKey })
    return { error }
  }

  const updateRequirement = async (id: string, updates: Partial<RequirementInput>) => {
    const { error } = await supabase.from('rota_requirements').update(updates).eq('id', id)
    if (!error) queryClient.invalidateQueries({ queryKey })
    return { error }
  }

  const deleteRequirement = async (id: string) => {
    const { error } = await supabase.from('rota_requirements').delete().eq('id', id)
    if (!error) queryClient.invalidateQueries({ queryKey })
    return { error }
  }

  // Helper: requirements grouped by day_of_week
  const byDay: Record<number, RotaRequirement[]> = Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7].map(d => [d, requirements.filter(r => r.day_of_week === d)])
  )

  // Total slots to fill across all days (each slot × staff_count)
  const totalSlots = requirements.reduce((acc, r) => acc + (r.staff_count ?? 1), 0)

  return {
    requirements, byDay, totalSlots,
    loading, reload,
    addRequirement, updateRequirement, deleteRequirement,
  }
}
