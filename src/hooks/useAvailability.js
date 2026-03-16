import { useState, useEffect, useCallback } from 'react'
import { format, addWeeks, addDays, eachDayOfInterval, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'

/**
 * Fetches manual unavailability + approved time-off for visible weeks.
 * Returns a lookup map keyed by "staffId:yyyy-MM-dd" → { type, note? }
 */
export function useAvailability(weekStart, numWeeks = 1) {
  const [unavailability, setUnavailability] = useState({})
  const [loading, setLoading] = useState(true)

  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endDate  = addDays(addWeeks(weekStart, numWeeks), -1)
  const endStr   = format(endDate, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    const map = {}

    const [manualRes, timeOffRes] = await Promise.all([
      // Manual unavailability rows
      supabase
        .from('staff_availability')
        .select('staff_id, date, note')
        .gte('date', startStr)
        .lte('date', endStr),
      // Approved time-off that overlaps visible range
      supabase
        .from('time_off_requests')
        .select('staff_id, start_date, end_date, reason')
        .eq('status', 'approved')
        .lte('start_date', endStr)
        .gte('end_date', startStr),
    ])

    // Manual entries
    for (const row of manualRes.data ?? []) {
      const key = `${row.staff_id}:${row.date}`
      map[key] = { type: 'manual', note: row.note }
    }

    // Approved time-off — expand date ranges into individual days
    for (const req of timeOffRes.data ?? []) {
      const s = parseISO(req.start_date)
      const e = parseISO(req.end_date)
      const days = eachDayOfInterval({ start: s, end: e })
      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd')
        // Only include days within visible range
        if (dayStr >= startStr && dayStr <= endStr) {
          const key = `${req.staff_id}:${dayStr}`
          // Time-off takes precedence over manual
          map[key] = { type: 'time_off', note: req.reason }
        }
      }
    }

    setUnavailability(map)
    setLoading(false)
  }, [startStr, endStr])

  useEffect(() => { load() }, [load])

  const toggleAvailability = useCallback(async (staffId, date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const key = `${staffId}:${dateStr}`

    // Don't allow toggling time-off entries
    if (unavailability[key]?.type === 'time_off') return

    if (unavailability[key]) {
      // Remove manual unavailability → make available
      await supabase
        .from('staff_availability')
        .delete()
        .eq('staff_id', staffId)
        .eq('date', dateStr)
    } else {
      // Add manual unavailability
      await supabase
        .from('staff_availability')
        .insert({ staff_id: staffId, date: dateStr })
    }

    load()
  }, [unavailability, load])

  return { unavailability, loading, reload: load, toggleAvailability }
}
