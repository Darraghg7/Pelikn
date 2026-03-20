/**
 * useHotHolding — data hooks for hot_holding_items and hot_holding_logs.
 * UK Food Safety regulations: hot food held for service must be ≥63°C.
 * Venues should check twice daily: AM and PM.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const HOT_HOLDING_MIN_TEMP = 63  // °C — UK Food Safety (Temperature Control) Regs 1995

/** Returns true when a hot holding temp is a fail. */
export function isHotHoldingFail(temperature) {
  return parseFloat(temperature) < HOT_HOLDING_MIN_TEMP
}

/**
 * useHotHoldingItems — fetches all active hot holding items for this venue.
 * Managers can add/remove items; staff log readings against them.
 */
export function useHotHoldingItems() {
  const { venueId } = useVenue()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('hot_holding_items')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  return { items, loading, reload: load }
}

/**
 * useHotHoldingTodayStatus — returns which check periods have been completed today.
 * Returns { am: bool, pm: bool, amLogs: [...], pmLogs: [...] }
 */
export function useHotHoldingTodayStatus() {
  const { venueId } = useVenue()
  const [status, setStatus]   = useState({ am: false, pm: false, amLogs: [], pmLogs: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('hot_holding_logs')
      .select('*')
      .eq('venue_id', venueId)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`)
      .order('logged_at', { ascending: false })

    const logs = data ?? []
    const amLogs = logs.filter(l => l.check_period === 'am')
    const pmLogs = logs.filter(l => l.check_period === 'pm')
    setStatus({ am: amLogs.length > 0, pm: pmLogs.length > 0, amLogs, pmLogs })
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  return { status, loading, reload: load }
}

/**
 * useHotHoldingLogs — fetches hot_holding_logs with optional date range filter.
 * @param {string|null} dateFrom  — ISO date e.g. '2025-01-01'
 * @param {string|null} dateTo    — ISO date e.g. '2025-01-31'
 */
export function useHotHoldingLogs(dateFrom = null, dateTo = null) {
  const { venueId } = useVenue()
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    let q = supabase
      .from('hot_holding_logs')
      .select('*')
      .eq('venue_id', venueId)
      .order('logged_at', { ascending: false })
      .limit(300)

    if (dateFrom) q = q.gte('logged_at', `${dateFrom}T00:00:00`)
    if (dateTo)   q = q.lte('logged_at', `${dateTo}T23:59:59`)

    const { data, error } = await q
    if (!error) setLogs(data ?? [])
    setLoading(false)
  }, [venueId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  return { logs, loading, reload: load }
}
