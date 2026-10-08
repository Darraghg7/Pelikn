import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/reportError'

// Compute total worked hours and distinct worked days from clock_events for a staff member in a calendar year.
// Pairs clock_in → clock_out, subtracts break time.
async function fetchWorkedStats(staffId, year) {
  const { data, error } = await supabase
    .from('clock_events')
    .select('event_type, occurred_at')
    .eq('staff_id', staffId)
    .gte('occurred_at', `${year}-01-01T00:00:00Z`)
    .lt('occurred_at',  `${year + 1}-01-01T00:00:00Z`)
    .order('occurred_at', { ascending: true })
  if (error) throw error
  if (!data?.length) return { totalHours: 0, distinctDays: 0 }

  let total = 0, clockIn = null
  const workedDays = new Set()
  for (const ev of data) {
    const t = new Date(ev.occurred_at)
    const dayKey = t.toISOString().slice(0, 10)
    if (ev.event_type === 'clock_in')    { clockIn = t }
    if (ev.event_type === 'break_start') { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
    if (ev.event_type === 'break_end')   { clockIn = t }
    if (ev.event_type === 'clock_out')   {
      if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null; workedDays.add(dayKey) }
    }
  }
  return { totalHours: total, distinctDays: workedDays.size }
}

// Keep old helper for batch version below
async function fetchWorkedHours(staffId, year) {
  const { totalHours } = await fetchWorkedStats(staffId, year)
  return totalHours
}

// Hook for a single zero-hours staff member.
// Returns:
//   accrued      — holiday hours earned (12.07% of worked hours, capped 224)
//   workedHours  — raw total hours worked this year
//   avgDailyHours — workedHours / distinctDaysWorked, or 7.6 (UK default) if <3 shifts
export function useZeroHoursAccrual(staffId, leaveYear) {
  const year = leaveYear ?? new Date().getFullYear()
  const [accrued, setAccrued]           = useState(null)
  const [workedHours, setWorkedHours]   = useState(null)
  const [avgDailyHours, setAvgDaily]    = useState(7.6)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!staffId) { setLoading(false); return }
    let cancelled = false
    fetchWorkedStats(staffId, year).then(({ totalHours, distinctDays }) => {
      if (!cancelled) {
        setAccrued(Math.min(Math.round(totalHours * 0.1207 * 10) / 10, 224))
        setWorkedHours(Math.round(totalHours * 10) / 10)
        setAvgDaily(distinctDays >= 3 ? Math.round((totalHours / distinctDays) * 10) / 10 : 7.6)
        setLoading(false)
      }
    }).catch((e) => {
      // Accrued stays null (shown as unknown), not 0h.
      reportError(e, 'useZeroHoursAccrual')
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [staffId, year])

  return { accrued, workedHours, avgDailyHours, loading }
}

// Batch version for the manager team view — one query for all zero-hours staff.
// Returns a map of staffId → accrued hours.
export function useTeamZeroHoursAccruals(staffIds, leaveYear) {
  const year = leaveYear ?? new Date().getFullYear()
  // Callers pass a fresh array each render; key on its contents instead so the
  // effect only re-runs when the actual set of ids changes.
  const key  = staffIds.join(',')
  const ids  = useMemo(() => (key ? key.split(',') : []), [key])
  const [map, setMap]       = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ids.length) { setMap({}); setLoading(false); return }
    let cancelled = false
    supabase
      .from('clock_events')
      .select('staff_id, event_type, occurred_at')
      .in('staff_id', ids)
      .gte('occurred_at', `${year}-01-01T00:00:00Z`)
      .lt('occurred_at',  `${year + 1}-01-01T00:00:00Z`)
      .order('occurred_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        // Accrual is a hint beside each balance — leave it blank, not 0h.
        if (error) { reportError(error, 'useTeamZeroHoursAccruals'); setLoading(false); return }
        // Group events by staff_id
        const grouped = {}
        for (const ev of (data ?? [])) {
          if (!grouped[ev.staff_id]) grouped[ev.staff_id] = []
          grouped[ev.staff_id].push(ev)
        }
        // Compute accrued hours per person
        const result = {}
        for (const sid of ids) {
          const evs = grouped[sid] ?? []
          let total = 0, clockIn = null
          for (const ev of evs) {
            const t = new Date(ev.occurred_at)
            if (ev.event_type === 'clock_in')    { clockIn = t }
            if (ev.event_type === 'break_start') { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
            if (ev.event_type === 'break_end')   { clockIn = t }
            if (ev.event_type === 'clock_out')   { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
          }
          result[sid] = Math.min(Math.round(total * 0.1207 * 10) / 10, 224)
        }
        setMap(result)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [ids, year])

  return { map, loading }
}
