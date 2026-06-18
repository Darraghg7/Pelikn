import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

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
  name: string
  startDate: string
  endDate: string
  type: 'leave'
}

export default function useManagerCalendar() {
  const { venueId } = useVenue()
  const qc = useQueryClient()
  const key = ['manager_calendar_events', venueId]
  const leaveKey = ['calendar_staff_leave', venueId]

  const { data: events = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase
        .from('manager_calendar_events')
        .select('*')
        .eq('venue_id', venueId)
        .order('start_date')
      return (data ?? []) as CalendarEvent[]
    },
    enabled: !!venueId,
  })

  // Approved staff leave — used to feed the calendar
  const { data: staffLeave = [] } = useQuery({
    queryKey: leaveKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('time_off_requests')
        .select('staff_id, start_date, end_date, status, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('status', 'approved')
      return ((data ?? []) as any[]).map(r => ({
        name: r.staff?.name ?? 'Staff',
        startDate: r.start_date,
        endDate: r.end_date,
        type: 'leave' as const,
      }))
    },
    enabled: !!venueId,
  })

  const save = useMutation({
    mutationFn: async (ev: Omit<CalendarEvent, 'id' | 'venue_id'> & { id?: string }) => {
      if (ev.id) {
        const { id, ...rest } = ev
        await supabase.from('manager_calendar_events').update(rest).eq('id', id)
      } else {
        await supabase.from('manager_calendar_events').insert({ ...ev, venue_id: venueId })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('manager_calendar_events').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  // Upcoming events in the next 14 days
  const today = new Date().toISOString().slice(0, 10)
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const upcomingCount = events.filter(e => e.start_date >= today && e.start_date <= in14).length

  return {
    events,
    staffLeave,
    isLoading,
    upcomingCount,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
  }
}
