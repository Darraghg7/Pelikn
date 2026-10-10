import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/reportError'

// UK irregular-hours accrual: 12.07% of hours worked, capped at 5.6 weeks × 40h
const ACCRUAL_RATE   = 0.1207
const ACCRUAL_CAP    = 224
// UK default working day, used until someone has a few shifts to average over
const DEFAULT_DAY_HOURS = 7.6
const PAGE_SIZE = 1000

const round1 = (n) => Math.round(n * 10) / 10

export function accruedHoursFor(totalHours) {
  return Math.min(round1(totalHours * ACCRUAL_RATE), ACCRUAL_CAP)
}

export function avgDailyHoursFor({ totalHours, distinctDays }) {
  return distinctDays >= 3 ? round1(totalHours / distinctDays) : DEFAULT_DAY_HOURS
}

// Total worked hours and distinct worked days from one person's clock_events
// (sorted oldest first). Pairs clock_in → clock_out, subtracts break time.
export function workedStatsFromEvents(events) {
  let total = 0, clockIn = null
  const workedDays = new Set()
  for (const ev of events) {
    const t = new Date(ev.occurred_at)
    if (ev.event_type === 'clock_in')    { clockIn = t }
    if (ev.event_type === 'break_start') { if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null } }
    if (ev.event_type === 'break_end')   { clockIn = t }
    if (ev.event_type === 'clock_out')   {
      if (clockIn) { total += (t - clockIn) / 3600000; clockIn = null; workedDays.add(t.toISOString().slice(0, 10)) }
    }
  }
  return { totalHours: total, distinctDays: workedDays.size }
}

// staffId → { totalHours, distinctDays } for a calendar year. Pages through the
// rows: the API returns at most 1000 per request, and a year of shifts for a
// team goes well past that — a single request quietly under-counted.
export async function fetchWorkedStatsByStaff(staffIds, year) {
  const events = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('clock_events')
      .select('id, staff_id, event_type, occurred_at')
      .in('staff_id', staffIds)
      .gte('occurred_at', `${year}-01-01T00:00:00Z`)
      .lt('occurred_at',  `${year + 1}-01-01T00:00:00Z`)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    events.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }
  const grouped = {}
  for (const ev of events) (grouped[ev.staff_id] ??= []).push(ev)
  const result = {}
  for (const sid of staffIds) result[sid] = workedStatsFromEvents(grouped[sid] ?? [])
  return result
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
  const [avgDailyHours, setAvgDaily]    = useState(DEFAULT_DAY_HOURS)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!staffId) { setLoading(false); return }
    let cancelled = false
    fetchWorkedStatsByStaff([staffId], year).then((byStaff) => {
      if (cancelled) return
      const stats = byStaff[staffId]
      setAccrued(accruedHoursFor(stats.totalHours))
      setWorkedHours(round1(stats.totalHours))
      setAvgDaily(avgDailyHoursFor(stats))
      setLoading(false)
    }).catch((e) => {
      // Accrued stays null (shown as unknown), not 0h.
      reportError(e, 'useZeroHoursAccrual')
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [staffId, year])

  return { accrued, workedHours, avgDailyHours, loading }
}

// Batch version for the manager team view — one paged query for all zero-hours staff.
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
    fetchWorkedStatsByStaff(ids, year).then((byStaff) => {
      if (cancelled) return
      const result = {}
      for (const sid of ids) result[sid] = accruedHoursFor(byStaff[sid].totalHours)
      setMap(result)
      setLoading(false)
    }).catch((e) => {
      // Accrual is a hint beside each balance — leave it blank, not 0h.
      reportError(e, 'useTeamZeroHoursAccruals')
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [ids, year])

  return { map, loading }
}
