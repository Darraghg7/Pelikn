import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export function useShifts(weekStart) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!weekStart) return
    setLoading(true)
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const { data } = await supabase
      .from('shifts')
      .select('*, staff(id, name, email, hourly_rate, job_role)')
      .eq('week_start', weekStartStr)
      .order('shift_date')
      .order('start_time')
    setShifts(data ?? [])
    setLoading(false)
  }, [weekStart])

  useEffect(() => { load() }, [load])
  return { shifts, loading, reload: load }
}

export function useStaffList() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('staff')
      .select('id, name, email, role, job_role, hourly_rate')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setStaff(data ?? [])
        setLoading(false)
      })
  }, [])

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
