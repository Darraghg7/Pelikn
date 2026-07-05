import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { londonToday, londonWallTimeToInstant } from '../lib/time'

type NotificationSeverity = 'critical' | 'warning' | 'info'

interface StaffNotification {
  id: string
  type: string
  message: string
  link: string
  severity: NotificationSeverity
}

/**
 * Computes staff-facing notifications scoped to a venue.
 * Shows the current staff member their own relevant updates.
 */
export function useStaffNotifications(staffId: string): {
  notifications: StaffNotification[]
  count: number
  loading: boolean
} {
  const { venueId } = useVenue()

  const { data: notifications, isLoading: loading } = useQuery({
    queryKey: ['staff-notifications', staffId, venueId],
    queryFn: () => loadStaffNotifications(staffId, venueId),
    enabled: !!staffId && !!venueId,
    placeholderData: [],
    staleTime: 60_000,
  })

  return { notifications: (notifications ?? []) as StaffNotification[], count: (notifications ?? []).length, loading }
}

async function loadStaffNotifications(staffId: string, venueId: string): Promise<StaffNotification[]> {
  const items: StaffNotification[] = []
  const since = format(subDays(new Date(), 7), 'yyyy-MM-dd')

  await Promise.all([
    checkMySwapUpdates(items, staffId, venueId, since),
    checkMyTimeOffUpdates(items, staffId, venueId, since),
    checkMyUpcomingShift(items, staffId, venueId),
  ])

  const sevOrder: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2))
  return items
}

async function checkMySwapUpdates(items: StaffNotification[], staffId: string, venueId: string, since: string): Promise<void> {
  const { data } = await supabase
    .from('shift_swaps')
    .select('id, status, updated_at')
    .eq('venue_id', venueId)
    .eq('requester_id', staffId)
    .in('status', ['approved', 'rejected'])
    .gte('updated_at', since + 'T00:00:00')
    .order('updated_at', { ascending: false })
    .limit(10)

  for (const swap of (data ?? []) as { id: string; status: string }[]) {
    items.push({
      id: `swap-${swap.id}`,
      type: swap.status === 'approved' ? 'swap_approved' : 'swap_rejected',
      message: `Your shift swap request was ${swap.status}`,
      link: '/rota',
      severity: swap.status === 'approved' ? 'info' : 'warning',
    })
  }
}

async function checkMyTimeOffUpdates(items: StaffNotification[], staffId: string, venueId: string, since: string): Promise<void> {
  const { data } = await supabase
    .from('time_off_requests')
    .select('id, status, start_date, end_date, updated_at')
    .eq('venue_id', venueId)
    .eq('staff_id', staffId)
    .in('status', ['approved', 'rejected'])
    .gte('updated_at', since + 'T00:00:00')
    .order('updated_at', { ascending: false })
    .limit(10)

  for (const req of (data ?? []) as { id: string; status: string; start_date: string; end_date: string }[]) {
    const dateRange = req.start_date === req.end_date
      ? req.start_date
      : `${req.start_date} – ${req.end_date}`
    items.push({
      id: `timeoff-${req.id}`,
      type: req.status === 'approved' ? 'time_off_approved' : 'time_off_rejected',
      message: `Time off ${dateRange}: ${req.status}`,
      link: '/time-off',
      severity: req.status === 'approved' ? 'info' : 'warning',
    })
  }
}

async function checkMyUpcomingShift(items: StaffNotification[], staffId: string, venueId: string): Promise<void> {
  const now = new Date()
  const today = londonToday()

  const { data } = await supabase
    .from('shifts')
    .select('id, shift_date, start_time, end_time')
    .eq('venue_id', venueId)
    .eq('staff_id', staffId)
    .eq('shift_date', today)
    .order('start_time')
    .limit(5)

  for (const shift of (data ?? []) as { id: string; shift_date: string; start_time: string; end_time: string }[]) {
    // Scheduled start is UK wall-clock (Europe/London), not the device tz.
    const shiftStart = londonWallTimeToInstant(shift.shift_date, shift.start_time)
    const minsUntil = (shiftStart.getTime() - now.getTime()) / 60000
    // Only show if shift is within the next 2 hours and hasn't started yet
    if (minsUntil > 0 && minsUntil <= 120) {
      items.push({
        id: `shift-${shift.id}`,
        type: 'upcoming_shift',
        message: `Shift starting at ${shift.start_time.slice(0, 5)} today`,
        link: '/clock',
        severity: 'info',
      })
    }
  }
}
