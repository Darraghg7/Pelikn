import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export function useFridges() {
  const { venueId } = useVenue()
  const [fridges, setFridges] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase
      .from('fridges')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
    setFridges(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { fridges, loading, reload: load }
}

export function useFridgeDashboard() {
  const { venueId } = useVenue()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    const { data: fridges } = await supabase
      .from('fridges')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')

    if (!fridges) { setLoading(false); return }

    const enriched = await Promise.all(
      fridges.map(async (f) => {
        const { data: logs } = await supabase
          .from('fridge_temperature_logs')
          .select('temperature, logged_at, logged_by_name')
          .eq('fridge_id', f.id)
          .order('logged_at', { ascending: false })
          .limit(1)
        return { ...f, lastLog: logs?.[0] ?? null }
      })
    )
    setData(enriched)
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

export function useTodayCheckStatus() {
  const { venueId } = useVenue()
  const [status, setStatus] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: fridges }, { data: logs }] = await Promise.all([
      supabase.from('fridges').select('*').eq('venue_id', venueId).eq('is_active', true).order('name'),
      supabase.from('fridge_temperature_logs').select('*')
        .eq('venue_id', venueId)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .order('logged_at', { ascending: false }),
    ])

    const result = (fridges ?? []).map(f => {
      const fridgeLogs = (logs ?? []).filter(l => l.fridge_id === f.id)
      const am = fridgeLogs.find(l => l.check_period === 'am') ?? null
      const pm = fridgeLogs.find(l => l.check_period === 'pm') ?? null
      return { ...f, am, pm }
    })

    setStatus(result)
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { status, loading, reload: load }
}

export function useFridgeHistory(fridgeId, dateFrom, dateTo) {
  const { venueId } = useVenue()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    let q = supabase
      .from('fridge_temperature_logs')
      .select('*, fridges(name, min_temp, max_temp)')
      .eq('venue_id', venueId)
      .order('logged_at', { ascending: false })

    if (fridgeId) q = q.eq('fridge_id', fridgeId)
    if (dateFrom) q = q.gte('logged_at', dateFrom)
    if (dateTo)   q = q.lte('logged_at', dateTo)

    const { data } = await q
    setLogs(data ?? [])
    setLoading(false)
  }, [venueId, fridgeId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  return { logs, loading, reload: load }
}
