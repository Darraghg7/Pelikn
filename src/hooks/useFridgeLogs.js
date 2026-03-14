import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useFridges() {
  const [fridges, setFridges] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('fridges')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setFridges(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { fridges, loading, reload: load }
}

export function useFridgeDashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    // Fetch fridges + the most recent log for each
    const { data: fridges } = await supabase
      .from('fridges')
      .select('*')
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
  }, [])

  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

export function useFridgeHistory(fridgeId, dateFrom, dateTo) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('fridge_temperature_logs')
      .select('*, fridges(name, min_temp, max_temp)')
      .order('logged_at', { ascending: false })

    if (fridgeId) q = q.eq('fridge_id', fridgeId)
    if (dateFrom) q = q.gte('logged_at', dateFrom)
    if (dateTo)   q = q.lte('logged_at', dateTo)

    const { data } = await q
    setLogs(data ?? [])
    setLoading(false)
  }, [fridgeId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  return { logs, loading, reload: load }
}
