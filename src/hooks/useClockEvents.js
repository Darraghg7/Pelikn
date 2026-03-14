import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfDay, endOfDay } from 'date-fns'

export function useClockStatus(staffId) {
  const [status, setStatus] = useState(null)   // 'clocked_out' | 'clocked_in' | 'on_break'
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (id) => {
    const sid = id ?? staffId
    if (!sid) return
    setLoading(true)
    const todayStart = startOfDay(new Date()).toISOString()
    const { data } = await supabase
      .from('clock_events')
      .select('event_type')
      .eq('staff_id', sid)
      .gte('occurred_at', todayStart)
      .order('occurred_at', { ascending: false })
      .limit(1)

    const last = data?.[0]?.event_type
    if (!last || last === 'clock_out')   setStatus('clocked_out')
    else if (last === 'break_start')     setStatus('on_break')
    else                                  setStatus('clocked_in')
    setLoading(false)
  }, [staffId])

  return { status, loading, reload: load }
}

export function useTimesheetData(staffIds, dateFrom, dateTo) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    let q = supabase
      .from('clock_events')
      .select('staff_id, event_type, occurred_at, staff(name)')
      .gte('occurred_at', dateFrom)
      .lte('occurred_at', dateTo)
      .order('staff_id')
      .order('occurred_at')

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }, [dateFrom, dateTo])

  return { rows, loading, reload: load }
}
