import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface FoodAllergen {
  allergen: string
}

interface FoodItem {
  id: string
  name: string
  is_active: boolean
  venue_id: string
  food_allergens?: FoodAllergen[]
  [key: string]: unknown
}

interface UseFoodItemsOptions {
  includeInactive?: boolean
}

export function useFoodItems(search = '', options: UseFoodItemsOptions = {}): {
  items: FoodItem[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const includeInactive = options.includeInactive ?? false

  const queryKey = ['food_items', venueId, search, includeInactive]

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('food_items')
        .select('*, food_allergens(allergen)')
        .eq('venue_id', venueId)
        .order('name')

      if (!includeInactive) q = q.eq('is_active', true)
      if (search) q = q.ilike('name', `%${search}%`)

      const { data } = await q
      return (data ?? []) as FoodItem[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { items, loading, reload }
}

export function useFoodItem(id: string): { item: FoodItem | null; loading: boolean } {
  const { venueId } = useVenue()

  const { data: item = null, isLoading: loading } = useQuery({
    queryKey: ['food_item', venueId, id],
    queryFn: async () => {
      const { data } = await supabase
        .from('food_items')
        .select('*, food_allergens(allergen)')
        .eq('id', id)
        .eq('venue_id', venueId)
        .single()
      return (data ?? null) as FoodItem | null
    },
    enabled: !!id && !!venueId,
  })

  return { item, loading }
}
