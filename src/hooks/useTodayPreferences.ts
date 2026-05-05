import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_TODAY_ITEMS } from '../pages/dashboard/todayItemRegistry'

function prefsKey(staffId: string | null, venueId: string | null): string {
  return `pelikn_today_items_${venueId ?? 'venue'}_${staffId ?? 'staff'}`
}

export function useTodayPreferences(staffId: string | null, venueId: string | null): {
  todayItemIds: string[]
  loading: boolean
  save: (newIds: string[]) => Promise<void>
} {
  const [itemIds, setItemIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staffId || !venueId) return
    let cancelled = false

    supabase
      .from('staff_dashboard_today_items')
      .select('item_id, position')
      .eq('venue_id', venueId)
      .eq('staff_id', staffId)
      .order('position')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          try {
            const stored = JSON.parse(localStorage.getItem(prefsKey(staffId, venueId)) || 'null')
            setItemIds(Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_TODAY_ITEMS)
          } catch {
            setItemIds(DEFAULT_TODAY_ITEMS)
          }
        } else {
          setItemIds(data?.length > 0 ? data.map(d => (d as { item_id: string }).item_id) : DEFAULT_TODAY_ITEMS)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [staffId, venueId])

  const save = useCallback(async (newIds: string[]) => {
    if (!staffId || !venueId) return
    setItemIds(newIds)
    localStorage.setItem(prefsKey(staffId, venueId), JSON.stringify(newIds))

    const { error } = await supabase
      .from('staff_dashboard_today_items')
      .delete()
      .eq('staff_id', staffId)
      .eq('venue_id', venueId)
    if (error) return

    if (newIds.length > 0) {
      const rows = newIds.map((id, i) => ({ staff_id: staffId, item_id: id, position: i, venue_id: venueId }))
      await supabase.from('staff_dashboard_today_items').insert(rows)
    }
  }, [staffId, venueId])

  return { todayItemIds: itemIds ?? DEFAULT_TODAY_ITEMS, loading, save }
}
