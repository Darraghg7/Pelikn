import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchShifts, fetchStaffList } from '../lib/api/shifts'
import type { Shift, Staff } from '../types'
import { useStaffJobTitles } from './useVenueRoles'

export function useShifts(weekStart: Date | null, numWeeks = 1): {
  shifts: Shift[]
  loading: boolean
  isError: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shifts', venueId, weekStart?.toISOString(), numWeeks],
    queryFn: () => fetchShifts(venueId!, weekStart!, numWeeks),
    enabled: !!weekStart && !!venueId,
  })

  return { shifts: (data ?? []) as Shift[], loading: isLoading, isError, reload: refetch }
}

export function useStaffList(): { staff: Staff[]; loading: boolean; isError: boolean; reload: () => void } {
  const { venueId } = useVenue()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['staffList', venueId],
    queryFn: () => fetchStaffList(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60_000,
  })

  // Job titles ride along on each person, so every rota view, the rota
  // builder and the image export read the same thing.
  const { titlesFor } = useStaffJobTitles()
  const staff = useMemo(() => ((data ?? []) as Staff[]).map((s) => {
    const job_titles = titlesFor(s.id)
    return { ...s, job_titles, job_title: job_titles[0] ?? null }
  }), [data, titlesFor])

  return { staff, loading: isLoading, isError, reload: refetch }
}

// Rota hours maths lives in src/lib/rota; re-exported so existing imports keep working.
export { shiftDurationHours, isOvernightShift, unpaidBreakMins, paidShiftHours } from '../lib/rota/hours'
