import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchFoodItems, fetchFoodItem, setFoodItemActive, replaceFoodItemAllergens,
  updateFoodItemMayContain, createFoodItem, addFoodItemAllergens,
} from '../lib/api/allergens'
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
  isError: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const includeInactive = options.includeInactive ?? false

  const queryKey = ['food_items', venueId, search, includeInactive]

  const { data: items = [], isLoading: loading, isError } = useQuery({
    queryKey,
    queryFn: async () => (await fetchFoodItems(venueId!, search, includeInactive)) as FoodItem[],
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { items, loading, isError, reload }
}

export function useFoodItem(id: string): { item: FoodItem | null; loading: boolean } {
  const { venueId } = useVenue()

  const { data: item = null, isLoading: loading } = useQuery({
    queryKey: ['food_item', venueId, id],
    queryFn: async () => (await fetchFoodItem(venueId!, id)) as FoodItem | null,
    enabled: !!id && !!venueId,
  })

  return { item, loading }
}

/** Saving, hiding and showing dishes. Each one refreshes the lists and detail view that show them. */
export function useFoodItemActions() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['food_items', venueId] }),
    queryClient.invalidateQueries({ queryKey: ['food_item', venueId] }),
  ])

  return {
    setActive: async (id: string, isActive: boolean) => {
      await setFoodItemActive(venueId!, id, isActive)
      void refresh()
    },
    /** Edit an existing dish. `mayContainFailed` is true when the allergens saved but the rest didn't. */
    update: async (
      id: string,
      input: { sessionToken: string | undefined; name: string; description: string; allergens: string[]; mayContain: string[]; verbalNote: string },
    ): Promise<{ mayContainFailed: boolean }> => {
      await replaceFoodItemAllergens({
        sessionToken: input.sessionToken, venueId: venueId!, id,
        name: input.name, description: input.description, allergens: input.allergens,
      })
      try {
        await updateFoodItemMayContain(venueId!, id, input.mayContain, input.verbalNote)
      } catch {
        void refresh()
        return { mayContainFailed: true }
      }
      void refresh()
      return { mayContainFailed: false }
    },
    /** Add a dish. `allergensFailed` is true when the dish saved but its allergens didn't. */
    create: async (
      input: { name: string; description: string; allergens: string[]; mayContain: string[]; verbalNote: string },
    ): Promise<{ allergensFailed: boolean }> => {
      const created = await createFoodItem(venueId!, input)
      try {
        await addFoodItemAllergens(venueId!, created.id, input.allergens)
      } catch {
        void refresh()
        return { allergensFailed: true }
      }
      void refresh()
      return { allergensFailed: false }
    },
  }
}
