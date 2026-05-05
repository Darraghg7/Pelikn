import { supabase } from '../supabase'
import { format, addWeeks } from 'date-fns'
import type { Shift, Staff } from '../../types'

const SHIFT_SELECT = '*, staff(id, name, email, hourly_rate, job_role, is_under_18)'
const STAFF_SELECT = 'id, name, email, role, job_role, hourly_rate, skills, is_under_18, colour'

export async function fetchShifts(venueId: string, weekStart: Date, numWeeks = 1): Promise<Shift[]> {
  if (numWeeks <= 1) {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const { data } = await supabase
      .from('shifts')
      .select(SHIFT_SELECT)
      .eq('venue_id', venueId)
      .eq('week_start', weekStartStr)
      .order('shift_date')
      .order('start_time')
    return (data ?? []) as Shift[]
  }

  const weekStarts = Array.from({ length: numWeeks }, (_, i) =>
    format(addWeeks(weekStart, i), 'yyyy-MM-dd')
  )
  const { data } = await supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .eq('venue_id', venueId)
    .in('week_start', weekStarts)
    .order('shift_date')
    .order('start_time')
  return (data ?? []) as Shift[]
}

export async function fetchStaffList(venueId: string): Promise<Staff[]> {
  const [{ data: homeStaff }, { data: links }] = await Promise.all([
    supabase
      .from('staff')
      .select(STAFF_SELECT)
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('staff_venue_links')
      .select('staff_id, role, staff(id, name, email, job_role, hourly_rate, skills, is_under_18, colour)')
      .eq('venue_id', venueId),
  ])

  const linkedStaff = (links ?? []).map((l: any) => ({ ...l.staff, role: l.role, _crossVenue: true }))
  return [...(homeStaff ?? []), ...linkedStaff] as Staff[]
}
