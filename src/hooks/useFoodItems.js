import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export function useFoodItems(search = '') {
  const { venueId } = useVenue()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    let q = supabase
      .from('food_items')
      .select('*, food_allergens(allergen)')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')

    if (search) q = q.ilike('name', `%${search}%`)

    const { data } = await q
    setItems(data ?? [])
    setLoading(false)
  }, [venueId, search])

  useEffect(() => { load() }, [load])
  return { items, loading, reload: load }
}

export function useFoodItem(id) {
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supabase
      .from('food_items')
      .select('*, food_allergens(allergen)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setItem(data)
        setLoading(false)
      })
  }, [id])

  return { item, loading }
}
