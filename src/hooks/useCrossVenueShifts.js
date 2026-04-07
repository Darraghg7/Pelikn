import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addWeeks } from 'date-fns'

/**
 * Fetches shifts at OTHER venues for staff who are linked cross-venue.
 * Used by RotaPage to show "Busy at [Venue X]" conflict cells.
 *
 * @param {Array}  staff          - full staff list from useStaffList (may include _crossVenue items)
 * @param {Date}   weekStart      - start of the current rota view
 * @param {number} numWeeks       - number of weeks in view
 * @param {string} currentVenueId - the venue we're currently viewing (exclude from results)
 * @returns {Array} crossShifts — [{ staff_id, shift_date, start_time, end_time, venue_name, venue_slug }]
 */
export function useCrossVenueShifts(staff, weekStart, numWeeks = 1, currentVenueId) {
  const [crossShifts, setCrossShifts] = useState([])

  useEffect(() => {
    if (!staff?.length || !weekStart || !currentVenueId) return

    // Only query for staff who are linked from another venue
    const linkedStaff = staff.filter(s => s._crossVenue)
    if (!linkedStaff.length) { setCrossShifts([]); return }

    let cancelled = false
    const staffIds  = linkedStaff.map(s => s.id)
    const dateFrom  = format(weekStart, 'yyyy-MM-dd')
    const dateTo    = format(addWeeks(weekStart, numWeeks), 'yyyy-MM-dd')

    supabase.rpc('get_staff_cross_venue_shifts', {
      p_staff_ids:        staffIds,
      p_date_from:        dateFrom,
      p_date_to:          dateTo,
      p_exclude_venue_id: currentVenueId,
    })
      .then(({ data }) => {
        if (!cancelled) setCrossShifts(data ?? [])
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [staff, weekStart, numWeeks, currentVenueId])

  return crossShifts
}
