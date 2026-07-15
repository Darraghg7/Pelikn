import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_WIDGETS } from '../components/widgets/WidgetRegistry'

// Last-known widget layout per staff+venue, so the dashboard renders the right
// widgets immediately instead of showing defaults and re-shuffling after fetch.
const layoutKey = (staffId: string, venueId: string) => `pelikn_widget_layout_${staffId}_${venueId}`

function readCachedLayout(staffId: string | null, venueId: string | null): string[] | null {
  if (!staffId || !venueId) return null
  try {
    const raw = localStorage.getItem(layoutKey(staffId, venueId))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

export function useWidgetPreferences(staffId: string | null, venueId: string | null): {
  widgetIds: string[]
  loading: boolean
  save: (newIds: string[]) => Promise<void>
} {
  const [widgetIds, setWidgetIds] = useState<string[] | null>(() => readCachedLayout(staffId, venueId))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staffId || !venueId) return
    let cancelled = false

    setWidgetIds(readCachedLayout(staffId, venueId))

    supabase
      .from('dashboard_widgets')
      .select('widget_id, position')
      .eq('venue_id', venueId)
      .eq('staff_id', staffId)
      .order('position')
      .then(({ data }) => {
        if (cancelled) return
        const ids = data && data.length > 0 ? data.map(d => (d as { widget_id: string }).widget_id) : DEFAULT_WIDGETS
        try { localStorage.setItem(layoutKey(staffId, venueId), JSON.stringify(ids)) } catch { /* best-effort */ }
        setWidgetIds(ids)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [staffId, venueId])

  const save = useCallback(async (newIds: string[]) => {
    if (!staffId || !venueId) return
    setWidgetIds(newIds)
    try { localStorage.setItem(layoutKey(staffId, venueId), JSON.stringify(newIds)) } catch { /* best-effort */ }
    await supabase.from('dashboard_widgets').delete().eq('staff_id', staffId).eq('venue_id', venueId)
    if (newIds.length > 0) {
      const rows = newIds.map((id, i) => ({ staff_id: staffId, widget_id: id, position: i, venue_id: venueId }))
      await supabase.from('dashboard_widgets').insert(rows)
    }
  }, [staffId, venueId])

  return { widgetIds: widgetIds ?? DEFAULT_WIDGETS, loading, save }
}
