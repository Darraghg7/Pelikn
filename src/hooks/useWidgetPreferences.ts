import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_WIDGETS } from '../components/widgets/WidgetRegistry'

export function useWidgetPreferences(staffId: string | null, venueId: string | null): {
  widgetIds: string[]
  loading: boolean
  save: (newIds: string[]) => Promise<void>
} {
  const [widgetIds, setWidgetIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staffId || !venueId) return
    let cancelled = false

    supabase
      .from('dashboard_widgets')
      .select('widget_id, position')
      .eq('venue_id', venueId)
      .eq('staff_id', staffId)
      .order('position')
      .then(({ data }) => {
        if (cancelled) return
        setWidgetIds(data?.length > 0 ? data.map(d => (d as { widget_id: string }).widget_id) : DEFAULT_WIDGETS)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [staffId, venueId])

  const save = useCallback(async (newIds: string[]) => {
    if (!staffId || !venueId) return
    setWidgetIds(newIds)
    await supabase.from('dashboard_widgets').delete().eq('staff_id', staffId).eq('venue_id', venueId)
    if (newIds.length > 0) {
      const rows = newIds.map((id, i) => ({ staff_id: staffId, widget_id: id, position: i, venue_id: venueId }))
      await supabase.from('dashboard_widgets').insert(rows)
    }
  }, [staffId, venueId])

  return { widgetIds: widgetIds ?? DEFAULT_WIDGETS, loading, save }
}
