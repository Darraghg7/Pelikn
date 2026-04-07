import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { format, addWeeks } from 'date-fns'

export function useShifts(weekStart, numWeeks = 1) {
  const { venueId } = useVenue()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!weekStart || !venueId) return
    setLoading(true)
    if (numWeeks <= 1) {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      const { data } = await supabase
        .from('shifts')
        .select('*, staff(id, name, email, hourly_rate, job_role, is_under_18)')
        .eq('venue_id', venueId)
        .eq('week_start', weekStartStr)
        .order('shift_date')
        .order('start_time')
      setShifts(data ?? [])
    } else {
      const weekStarts = Array.from({ length: numWeeks }, (_, i) =>
        format(addWeeks(weekStart, i), 'yyyy-MM-dd')
      )
      const { data } = await supabase
        .from('shifts')
        .select('*, staff(id, name, email, hourly_rate, job_role, is_under_18)')
        .eq('venue_id', venueId)
        .in('week_start', weekStarts)
        .order('shift_date')
        .order('start_time')
      setShifts(data ?? [])
    }
    setLoading(false)
  }, [venueId, weekStart, numWeeks])

  useEffect(() => { load() }, [load])
  return { shifts, loading, reload: load }
}

export function useStaffList() {
  const { venueId } = useVenue()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) return
    let cancelled = false

    async function load() {
      // Fetch home staff and cross-venue links in parallel
      const [{ data: homeStaff }, { data: links }] = await Promise.all([
        supabase
          .from('staff')
          .select('id, name, email, role, job_role, hourly_rate, skills, is_under_18, colour')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('staff_venue_links')
          .select('staff_id, role, staff(id, name, email, job_role, hourly_rate, skills, is_under_18, colour)')
          .eq('venue_id', venueId),
      ])

      if (cancelled) return
      const linkedStaff = (links ?? []).map(l => ({ ...l.staff, role: l.role, _crossVenue: true }))
      setStaff([...(homeStaff ?? []), ...linkedStaff])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [venueId])

  return { staff, loading }
}

/** Compute shift duration in decimal hours from HH:mm strings. */
export function shiftDurationHours(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins   = eh * 60 + em
  return Math.max(0, (endMins - startMins) / 60)
}

/**
 * Unpaid break entitlement per shift.
 * Under-18 (Young Workers): fixed 30 min UK statutory if shift > 4.5h.
 * Adults (18+): manager-configured break duration if shift > 6h.
 *   customAdultBreakMins defaults to 30 (a common employer policy);
 *   the UK statutory minimum is 20 min but managers often give more.
 * Returns break duration in minutes (0 if no entitlement).
 */
export function unpaidBreakMins(rawHours, isUnder18, customAdultBreakMins = 30) {
  if (isUnder18 && rawHours > 4.5) return 30               // UK law, fixed
  if (!isUnder18 && rawHours > 6)  return customAdultBreakMins
  return 0
}

/**
 * Paid shift hours after deducting unpaid break.
 * Used for rota cost and hours totals.
 */
export function paidShiftHours(startTime, endTime, isUnder18 = false, customAdultBreakMins = 30) {
  const raw = shiftDurationHours(startTime, endTime)
  return Math.max(0, raw - unpaidBreakMins(raw, isUnder18, customAdultBreakMins) / 60)
}
