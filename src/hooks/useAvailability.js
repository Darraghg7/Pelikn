import { useState, useEffect, useCallback } from 'react'
import { format, addWeeks, addDays, eachDayOfInterval, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

/**
 * Fetches manual unavailability + approved time-off for visible weeks.
 * Returns a lookup map keyed by "staffId:yyyy-MM-dd" -> { type, subtype?, note? }
 *
 * Manual entries have three states cycled via toggleAvailability:
 *   available (no row) -> unavailable -> break_cover -> available (delete row)
 */
export function useAvailability(weekStart, numWeeks = 1) {
  const { venueId } = useVenue()
  const [unavailability, setUnavailability] = useState({})
  const [loading, setLoading] = useState(true)

  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endDate  = addDays(addWeeks(weekStart, numWeeks), -1)
  const endStr   = format(endDate, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const map = {}

    const [manualRes, timeOffRes] = await Promise.all([
      supabase
        .from('staff_availability')
        .select('staff_id, date, note, availability_type')
        .eq('venue_id', venueId)
        .gte('date', startStr)
        .lte('date', endStr),
      supabase
        .from('time_off_requests')
        .select('staff_id, start_date, end_date, reason')
        .eq('venue_id', venueId)
        .eq('status', 'approved')
        .lte('start_date', endStr)
        .gte('end_date', startStr),
    ])

    // Manual entries
    for (const row of manualRes.data ?? []) {
      const key = `${row.staff_id}:${row.date}`
      map[key] = { type: 'manual', subtype: row.availability_type || 'unavailable', note: row.note }
    }

    // Approved time-off — expand date ranges into individual days
    for (const req of timeOffRes.data ?? []) {
      const s = parseISO(req.start_date)
      const e = parseISO(req.end_date)
      const days = eachDayOfInterval({ start: s, end: e })
      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd')
        if (dayStr >= startStr && dayStr <= endStr) {
          const key = `${req.staff_id}:${dayStr}`
          map[key] = { type: 'time_off', note: req.reason }
        }
      }
    }

    setUnavailability(map)
    setLoading(false)
  }, [venueId, startStr, endStr])

  useEffect(() => { load() }, [load])

  /**
   * Three-state toggle cycle:
   *   no row (available) -> insert unavailable -> update to break_cover -> delete row (available)
   */
  const toggleAvailability = useCallback(async (staffId, date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const key = `${staffId}:${dateStr}`

    // Don't allow toggling time-off entries
    if (unavailability[key]?.type === 'time_off') return

    const current = unavailability[key]

    if (!current) {
      await supabase
        .from('staff_availability')
        .insert({ staff_id: staffId, date: dateStr, availability_type: 'unavailable', venue_id: venueId })
    } else if (current.subtype === 'unavailable') {
      await supabase
        .from('staff_availability')
        .update({ availability_type: 'break_cover' })
        .eq('staff_id', staffId)
        .eq('date', dateStr)
    } else {
      await supabase
        .from('staff_availability')
        .delete()
        .eq('staff_id', staffId)
        .eq('date', dateStr)
    }

    load()
  }, [venueId, unavailability, load])

  return { unavailability, loading, reload: load, toggleAvailability }
}
