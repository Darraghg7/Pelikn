import { useQuery } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { fetchShifts, fetchStaffList } from '../lib/api/shifts'
import type { Shift, Staff } from '../types'

export function useShifts(weekStart: Date | null, numWeeks = 1): {
  shifts: Shift[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shifts', venueId, weekStart?.toISOString(), numWeeks],
    queryFn: () => fetchShifts(venueId!, weekStart!, numWeeks),
    enabled: !!weekStart && !!venueId,
  })

  return { shifts: (data ?? []) as Shift[], loading: isLoading, reload: refetch }
}

export function useStaffList(): { staff: Staff[]; loading: boolean } {
  const { venueId } = useVenue()

  const { data, isLoading } = useQuery({
    queryKey: ['staffList', venueId],
    queryFn: () => fetchStaffList(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60_000,
  })

  return { staff: (data ?? []) as Staff[], loading: isLoading }
}

/** Compute shift duration in decimal hours from HH:mm strings. */
/**
 * Length of a rota shift in hours. An end earlier than the start means the
 * shift finishes the next day (18:00–02:00 = 8h) — the same convention as
 * resolveShiftInstants() for clock sessions. Equal times are 0 (invalid).
 * This used to clamp overnight shifts to 0, which is why the rota refused
 * any shift past midnight ("End time must be after start time").
 */
export function shiftDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  let endMins     = eh * 60 + em
  if (endMins < startMins) endMins += 24 * 60
  return (endMins - startMins) / 60
}

/** True when a shift finishes the day after it starts. */
export function isOvernightShift(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false
  return endTime.slice(0, 5) < startTime.slice(0, 5)
}

/**
 * Unpaid break entitlement per shift.
 * Under-18 (Young Workers): fixed 30 min UK statutory if shift > 4.5h.
 * Adults (18+): manager-configured break duration if shift > 6h.
 *   customAdultBreakMins defaults to 30 (a common employer policy);
 *   the UK statutory minimum is 20 min but managers often give more.
 * Returns break duration in minutes (0 if no entitlement).
 */
export function unpaidBreakMins(rawHours: number, isUnder18: boolean, customAdultBreakMins = 30): number {
  if (isUnder18 && rawHours > 4.5) return 30               // UK law, fixed
  if (!isUnder18 && rawHours > 6)  return customAdultBreakMins
  return 0
}

/**
 * Paid shift hours after deducting unpaid break.
 * Used for rota cost and hours totals.
 */
export function paidShiftHours(startTime: string, endTime: string, isUnder18 = false, customAdultBreakMins = 30): number {
  const raw = shiftDurationHours(startTime, endTime)
  return Math.max(0, raw - unpaidBreakMins(raw, isUnder18, customAdultBreakMins) / 60)
}
