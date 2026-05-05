import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, addWeeks } from 'date-fns'
import type { Staff } from '../types'

interface CrossVenueShift {
  staff_id: string
  shift_date: string
  start_time: string
  end_time: string
  venue_name: string
  venue_slug: string
}

/**
 * Fetches shifts at OTHER venues for staff who are linked cross-venue.
 * Used by RotaPage to show "Busy at [Venue X]" conflict cells.
 *
 * @param staff          - full staff list from useStaffList (may include _crossVenue items)
 * @param weekStart      - start of the current rota view
 * @param numWeeks       - number of weeks in view
 * @param currentVenueId - the venue we're currently viewing (exclude from results)
 * @returns crossShifts — [{ staff_id, shift_date, start_time, end_time, venue_name, venue_slug }]
 */
export function useCrossVenueShifts(
  staff: Staff[],
  weekStart: Date | null,
  numWeeks = 1,
  currentVenueId: string
): CrossVenueShift[] {
  const linkedStaff = (staff ?? []).filter(s => s._crossVenue)
  const staffIds = linkedStaff.map(s => s.id)
  const dateFrom = weekStart ? format(weekStart, 'yyyy-MM-dd') : null
  const dateTo = weekStart ? format(addWeeks(weekStart, numWeeks), 'yyyy-MM-dd') : null

  const { data } = useQuery({
    queryKey: ['cross-venue-shifts', staffIds.sort().join(','), dateFrom, dateTo, currentVenueId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_staff_cross_venue_shifts', {
        p_staff_ids:        staffIds,
        p_date_from:        dateFrom,
        p_date_to:          dateTo,
        p_exclude_venue_id: currentVenueId,
      })
      return (data ?? []) as CrossVenueShift[]
    },
    enabled: staffIds.length > 0 && !!weekStart && !!currentVenueId,
    placeholderData: [],
  })

  return (data ?? []) as CrossVenueShift[]
}
