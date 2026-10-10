import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/reportError'
import { buildDailyGrid } from '../lib/timesheet'

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
// (sorted oldest first). Uses the timesheet's own session rules, so holiday
// accrues on exactly the hours the timesheet pays — an unfinished break isn't
// deducted, a stray break end is ignored, and days are UK dates.
export function workedStatsFromEvents(events) {
  let minutes = 0, distinctDays = 0
  for (const person of Object.values(buildDailyGrid(events))) {
    for (const day of Object.values(person.days)) {
      minutes += day.minutes
      if (day.minutes > 0) distinctDays++
    }
  }
  return { totalHours: minutes / 60, distinctDays }
}

// staffId → { totalHours, distinctDays } between two 'yyyy-MM-dd' dates
// (inclusive) — normally the venue's holiday year. Pages through the
// rows: the API returns at most 1000 per request, and a year of shifts for a
// team goes well past that — a single request quietly under-counted.
export async function fetchWorkedStatsByStaff(staffIds, from, to) {
  const events = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('clock_events')
      .select('id, staff_id, event_type, occurred_at')
      .in('staff_id', staffIds)
      .gte('occurred_at', `${from}T00:00:00Z`)
      .lte('occurred_at', `${to}T23:59:59.999Z`)
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

// leaveYear: { from, to } from lib/leaveYear
// Hook for a single zero-hours staff member.
// Returns:
//   accrued      — holiday hours earned (12.07% of worked hours, capped 224)
//   workedHours  — raw total hours worked this year
//   avgDailyHours — workedHours / distinctDaysWorked, or 7.6 (UK default) if <3 shifts
export function useZeroHoursAccrual(staffId, leaveYear) {
  const { from, to } = leaveYear
  const [accrued, setAccrued]           = useState(null)
  const [workedHours, setWorkedHours]   = useState(null)
  const [avgDailyHours, setAvgDaily]    = useState(DEFAULT_DAY_HOURS)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!staffId) { setLoading(false); return }
    let cancelled = false
    fetchWorkedStatsByStaff([staffId], from, to).then((byStaff) => {
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
  }, [staffId, from, to])

  return { accrued, workedHours, avgDailyHours, loading }
}

// Batch version for the manager team view — one paged query for all zero-hours staff.
// Returns a map of staffId → { accrued, avgDailyHours }.
export function useTeamZeroHoursAccruals(staffIds, leaveYear) {
  const { from, to } = leaveYear
  // Callers pass a fresh array each render; key on its contents instead so the
  // effect only re-runs when the actual set of ids changes.
  const key  = staffIds.join(',')
  const ids  = useMemo(() => (key ? key.split(',') : []), [key])
  const [map, setMap]       = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ids.length) { setMap({}); setLoading(false); return }
    let cancelled = false
    fetchWorkedStatsByStaff(ids, from, to).then((byStaff) => {
      if (cancelled) return
      const result = {}
      for (const sid of ids) {
        result[sid] = { accrued: accruedHoursFor(byStaff[sid].totalHours), avgDailyHours: avgDailyHoursFor(byStaff[sid]) }
      }
      setMap(result)
      setLoading(false)
    }).catch((e) => {
      // Accrual is a hint beside each balance — leave it blank, not 0h.
      reportError(e, 'useTeamZeroHoursAccruals')
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [ids, from, to])

  return { map, loading }
}
