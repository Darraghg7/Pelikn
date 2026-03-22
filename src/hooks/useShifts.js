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
    supabase
      .from('staff')
      .select('id, name, email, role, job_role, hourly_rate, skills, is_under_18')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setStaff(data ?? [])
        setLoading(false)
      })
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
 * UK statutory unpaid break entitlement (Working Time Regulations 1998).
 * Under 18 (Young Workers): 30 min if shift > 4.5 hours.
 * Adults (18+): 20 min if shift > 6 hours.
 * Returns break duration in minutes (0 if no entitlement).
 */
export function unpaidBreakMins(rawHours, isUnder18) {
  if (isUnder18 && rawHours > 4.5) return 30
  if (!isUnder18 && rawHours > 6) return 20
  return 0
}

/**
 * Paid shift hours after deducting statutory unpaid break.
 * Used for rota cost and hours totals.
 */
export function paidShiftHours(startTime, endTime, isUnder18 = false) {
  const raw = shiftDurationHours(startTime, endTime)
  return Math.max(0, raw - unpaidBreakMins(raw, isUnder18) / 60)
}
