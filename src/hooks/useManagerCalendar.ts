import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { emitDataWrite } from '../lib/cacheBus'
import useVenueClosures, { type VenueClosure } from './useVenueClosures'

export interface CalendarEvent {
  id: string
  venue_id: string
  title: string
  type: 'event' | 'closed' | 'meeting' | 'review' | 'delivery' | 'other'
  colour: string
  start_date: string   // 'YYYY-MM-DD'
  end_date: string
  all_day: boolean
  start_time?: string  // 'HH:MM'
  end_time?: string
  notes?: string
  reminder_days: number
  backup_reminder: boolean
}

export interface StaffLeaveEntry {
  staffId: string
  name: string
  startDate: string
  endDate: string
  leaveType: string
  type: 'leave'
}

/** A closure set in the Rota or Venue Settings — no calendar event behind it. */
export interface OtherClosure {
  id: string
  title: string
  start_date: string
  end_date: string
}

export function closuresWithoutEvent(closures: VenueClosure[], events: CalendarEvent[]): OtherClosure[] {
  return closures
    .filter(c => !c.calendar_event_id && !events.some(ev =>
      ev.type === 'closed' && ev.start_date === c.start_date && ev.end_date === c.end_date))
    .map(c => ({ id: c.id, title: c.reason || 'Closed', start_date: c.start_date, end_date: c.end_date }))
}

export default function useManagerCalendar() {
  const { venueId } = useVenue()
  const qc = useQueryClient()
  const key = ['manager_calendar_events', venueId]
  const leaveKey = ['calendar_staff_leave', venueId]

  const { data: events = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_calendar_events')
        .select('*')
        .eq('venue_id', venueId)
        .order('start_date')
      if (error) throw error
      return (data ?? []) as CalendarEvent[]
    },
    enabled: !!venueId,
  })

  // Approved staff leave — used to feed the calendar
  const { data: staffLeave = [] } = useQuery({
    queryKey: leaveKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_off_requests')
        .select('staff_id, start_date, end_date, status, leave_type, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('status', 'approved')
      if (error) throw error
      return ((data ?? []) as any[]).map(r => ({
        staffId: r.staff_id,
        name: r.staff?.name ?? 'Staff',
        startDate: r.start_date,
        endDate: r.end_date,
        leaveType: r.leave_type ?? 'other',
        type: 'leave' as const,
      }))
    },
    enabled: !!venueId,
  })

  // Checks, cleaning and the dashboard read closed days from venue_closures.
  // Migration 140 keeps a 'closed' event's closure row in step with it, so
  // that list is shown here too: closures set in the Rota or Venue Settings
  // have no event, and appear on the calendar read-only. Matching on dates as
  // well as calendar_event_id keeps 087's copies from showing twice before
  // 140 is applied.
  const { closures } = useVenueClosures()
  const otherClosures = closuresWithoutEvent(closures, events)

  // A closed event's closure row is written by a database trigger, which this
  // device's write bus never sees, so the dashboard tiles are told directly.
  const onWrite = () => {
    emitDataWrite('venue_closures')
    return qc.invalidateQueries({ queryKey: key })
  }

  const save = useMutation({
    mutationFn: async (ev: Omit<CalendarEvent, 'id' | 'venue_id'> & { id?: string }) => {
      if (ev.id) {
        const { id, ...rest } = ev
        const { error } = await supabase.from('manager_calendar_events').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('manager_calendar_events').insert({ ...ev, venue_id: venueId })
        if (error) throw error
      }
    },
    onSuccess: onWrite,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('manager_calendar_events').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: onWrite,
  })

  // Upcoming events in the next 14 days
  const today = new Date().toISOString().slice(0, 10)
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const upcomingCount = events.filter(e => e.start_date >= today && e.start_date <= in14).length

  return {
    events,
    staffLeave,
    otherClosures,
    isLoading,
    upcomingCount,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
  }
}
