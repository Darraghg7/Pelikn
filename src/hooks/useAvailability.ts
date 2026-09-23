import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { format, addWeeks, addDays, eachDayOfInterval, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { fetchTimeOffPrivateFields } from '../lib/api/timeOffPrivate'
import { useVenue } from '../contexts/VenueContext'

interface AvailabilityEntry {
  type: 'manual' | 'time_off'
  subtype?: string
  note?: string | null
}

type AvailabilityMap = Record<string, AvailabilityEntry>

/**
 * Fetches manual unavailability + approved time-off for visible weeks.
 * Returns a lookup map keyed by "staffId:yyyy-MM-dd" -> { type, subtype?, note? }
 *
 * Manual entries have three states cycled via toggleAvailability:
 *   available (no row) -> unavailable -> break_cover -> available (delete row)
 */
export function useAvailability(weekStart: Date, numWeeks = 1): {
  unavailability: AvailabilityMap
  loading: boolean
  reload: () => void
  toggleAvailability: (staffId: string, date: Date) => Promise<void>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endDate  = addDays(addWeeks(weekStart, numWeeks), -1)
  const endStr   = format(endDate, 'yyyy-MM-dd')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['availability', venueId, startStr, endStr],
    queryFn: async (): Promise<AvailabilityMap> => {
      if (!venueId) return {}
      const map: AvailabilityMap = {}

      const [manualRes, timeOffRes] = await Promise.all([
        supabase
          .from('staff_availability')
          .select('staff_id, date, note, availability_type')
          .eq('venue_id', venueId)
          .gte('date', startStr)
          .lte('date', endStr),
        supabase
          .from('time_off_requests')
          // `reason` is withheld by 119 — it was being read here for EVERY
          // approved request in the venue and written into the rota day note,
          // which staff can see. `id` is selected so the reasons the caller is
          // allowed to see can be merged back below.
          .select('id, staff_id, start_date, end_date')
          .eq('venue_id', venueId)
          .eq('status', 'approved')
          .lte('start_date', endStr)
          .gte('end_date', startStr),
      ])
      const timeOffPrivate = await fetchTimeOffPrivateFields()

      // Manual entries
      for (const row of (manualRes.data ?? []) as { staff_id: string; date: string; note?: string; availability_type?: string }[]) {
        const key = `${row.staff_id}:${row.date}`
        map[key] = { type: 'manual', subtype: row.availability_type || 'unavailable', note: row.note }
      }

      // Approved time-off — expand date ranges into individual days
      for (const req of (timeOffRes.data ?? []) as { id: string; staff_id: string; start_date: string; end_date: string }[]) {
        const s = parseISO(req.start_date)
        const e = parseISO(req.end_date)
        const days = eachDayOfInterval({ start: s, end: e })
        for (const day of days) {
          const dayStr = format(day, 'yyyy-MM-dd')
          if (dayStr >= startStr && dayStr <= endStr) {
            const key = `${req.staff_id}:${dayStr}`
            // undefined for a colleague's request unless you are a manager
            map[key] = { type: 'time_off', note: timeOffPrivate.get(req.id)?.reason ?? undefined }
          }
        }
      }

      return map
    },
    enabled: !!venueId,
  })

  const unavailability = data ?? {}

  /**
   * Three-state toggle cycle:
   *   no row (available) -> insert unavailable -> update to break_cover -> delete row (available)
   */
  const toggleAvailability = useCallback(async (staffId: string, date: Date) => {
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

    refetch()
  }, [venueId, unavailability, refetch])

  return { unavailability, loading: isLoading, reload: refetch, toggleAvailability }
}
