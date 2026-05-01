import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export function useFoodItems(search = '', options = {}) {
  const { venueId } = useVenue()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const includeInactive = options.includeInactive ?? false

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    let q = supabase
      .from('food_items')
      .select('*, food_allergens(allergen)')
      .eq('venue_id', venueId)
      .order('name')

    if (!includeInactive) q = q.eq('is_active', true)

    if (search) q = q.ilike('name', `%${search}%`)

    const { data } = await q
    setItems(data ?? [])
    setLoading(false)
  }, [venueId, search, includeInactive])

  useEffect(() => { load() }, [load])
  return { items, loading, reload: load }
}

export function useFoodItem(id) {
  const { venueId } = useVenue()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !venueId) { setLoading(false); return }
    supabase
      .from('food_items')
      .select('*, food_allergens(allergen)')
      .eq('id', id)
      .eq('venue_id', venueId)
      .single()
      .then(({ data }) => {
        setItem(data)
        setLoading(false)
      })
  }, [id, venueId])

  return { item, loading }
}
