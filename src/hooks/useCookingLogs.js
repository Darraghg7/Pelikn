/**
 * useCookingLogs — data hooks for cooking_temp_logs table.
 * UK legal minimum for cooking and reheating: ≥75°C (2-second hold).
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const COOKING_TARGET_TEMP = 75  // °C — UK Food Safety (Temperature Control) Regs 1995

/** Returns true when a cooking/reheating temp is a fail. */
export function isCookingTempFail(temperature, targetTemp = COOKING_TARGET_TEMP) {
  return parseFloat(temperature) < targetTemp
}

/**
 * useCookingLogs — fetches cooking_temp_logs filtered by type and optional date range.
 * @param {string|null} checkType  — 'cooking' | 'reheating' | null (both)
 * @param {string|null} dateFrom   — ISO date e.g. '2025-01-01'
 * @param {string|null} dateTo     — ISO date e.g. '2025-01-31'
 */
export function useCookingLogs(checkType = null, dateFrom = null, dateTo = null) {
  const { venueId } = useVenue()
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    let q = supabase
      .from('cooking_temp_logs')
      .select('*')
      .eq('venue_id', venueId)
      .order('logged_at', { ascending: false })
      .limit(200)

    if (checkType) q = q.eq('check_type', checkType)

    if (dateFrom) q = q.gte('logged_at', `${dateFrom}T00:00:00`)
    if (dateTo)   q = q.lte('logged_at', `${dateTo}T23:59:59`)

    const { data, error } = await q
    if (!error) setLogs(data ?? [])
    setLoading(false)
  }, [venueId, checkType, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  return { logs, loading, reload: load }
}

/**
 * useTodayCookingLogs — fetches today's cooking logs for the dashboard summary.
 */
export function useTodayCookingLogs() {
  const { venueId } = useVenue()
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('cooking_temp_logs')
      .select('*')
      .eq('venue_id', venueId)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`)
      .order('logged_at', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  return { logs, loading, reload: load }
}
