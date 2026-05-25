import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Compute total worked hours from clock_events for a staff member in a calendar year.
// Pairs clock_in → clock_out, subtracts break time.
async function fetchWorkedHours(staffId, year) {
  const { data } = await supabase
    .from('clock_events')
    .select('event_type, occurred_at')
    .eq('staff_id', staffId)
    .gte('occurred_at', `${year}-01-01T00:00:00Z`)
    .lt('occurred_at',  `${year + 1}-01-01T00:00:00Z`)
    .order('occurred_at', { ascending: true })
  if (!data?.length) return 0

  let total = 0, clockIn = null
  for (const ev of data) {
    const t = new Date(ev.occurred_at)
    if (ev.event_type === 'clock_in')    { clockIn = t }
    if (ev.event_type === 'break_start') { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
    if (ev.event_type === 'break_end')   { clockIn = t }
    if (ev.event_type === 'clock_out')   { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
  }
  return total
}

// Hook for a single zero-hours staff member.
// Returns accrued holiday hours = 12.07% of hours worked.
export function useZeroHoursAccrual(staffId, leaveYear) {
  const year = leaveYear ?? new Date().getFullYear()
  const [accrued, setAccrued] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staffId) { setLoading(false); return }
    let cancelled = false
    fetchWorkedHours(staffId, year).then(h => {
      if (!cancelled) {
        setAccrued(Math.round(h * 0.1207 * 10) / 10)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [staffId, year])

  return { accrued, loading }
}

// Batch version for the manager team view — one query for all zero-hours staff.
// Returns a map of staffId → accrued hours.
export function useTeamZeroHoursAccruals(staffIds, leaveYear) {
  const year = leaveYear ?? new Date().getFullYear()
  const key  = staffIds.join(',')
  const [map, setMap]       = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staffIds.length) { setMap({}); setLoading(false); return }
    let cancelled = false
    supabase
      .from('clock_events')
      .select('staff_id, event_type, occurred_at')
      .in('staff_id', staffIds)
      .gte('occurred_at', `${year}-01-01T00:00:00Z`)
      .lt('occurred_at',  `${year + 1}-01-01T00:00:00Z`)
      .order('occurred_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        // Group events by staff_id
        const grouped = {}
        for (const ev of (data ?? [])) {
          if (!grouped[ev.staff_id]) grouped[ev.staff_id] = []
          grouped[ev.staff_id].push(ev)
        }
        // Compute accrued hours per person
        const result = {}
        for (const sid of staffIds) {
          const evs = grouped[sid] ?? []
          let total = 0, clockIn = null
          for (const ev of evs) {
            const t = new Date(ev.occurred_at)
            if (ev.event_type === 'clock_in')    { clockIn = t }
            if (ev.event_type === 'break_start') { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
            if (ev.event_type === 'break_end')   { clockIn = t }
            if (ev.event_type === 'clock_out')   { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
          }
          result[sid] = Math.round(total * 0.1207 * 10) / 10
        }
        setMap(result)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [key, year]) // eslint-disable-line react-hooks/exhaustive-deps

  return { map, loading }
}
