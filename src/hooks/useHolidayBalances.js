import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { useAppSettings } from './useSettings'
import { fetchClockEvents, fetchAnnualLeave, fetchRotaHours, fetchPaidOut } from '../lib/api/holidayData'
import { fetchStaffPrivateFields } from '../lib/api/staffRestricted'
import { zeroHoursHoliday, NI_LOOKBACK_WEEKS } from '../lib/holiday'
import { londonToday } from '../lib/time'

export const HOLIDAY_BALANCES_KEY = 'holiday-balances'

/** Earliest date needed: the start of the year, or the NI look-back if that reaches further. */
function earliestNeeded(year, today) {
  const [y, m, d] = today.split('-').map(Number)
  const lookback = new Date(Date.UTC(y, m - 1, d - 7 * (NI_LOOKBACK_WEEKS + 1))).toISOString().slice(0, 10)
  const yearStart = `${year}-01-01`
  return lookback < yearStart ? lookback : yearStart
}

/**
 * Holiday positions for zero-hours staff, keyed by staff id. Anyone in
 * `staffList` who isn't zero-hours is skipped — their allowance is in days.
 *
 * Each entry is the result of lib/holiday's zeroHoursHoliday: check `status`
 * ('ok' | 'needs_region' | 'self_employed') before reading figures.
 *
 * @param {{id: string, employment_type?: string, working_days?: number[], holiday_pay_eligible?: boolean, start_date?: string|null}[]} staffList
 * @param {number} year
 */
export function useHolidayBalances(staffList, year) {
  const { venueId } = useVenue()
  const { holidayRegion } = useAppSettings()
  const queryClient = useQueryClient()

  const zero = useMemo(
    () => (staffList ?? []).filter(s => s?.id && s.employment_type === 'zero_hours'),
    [staffList],
  )
  const idsKey = zero.map(s => s.id).sort().join(',')
  const today = londonToday()

  const query = useQuery({
    queryKey: [HOLIDAY_BALANCES_KEY, venueId, idsKey, year],
    enabled: !!venueId && idsKey.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = idsKey.split(',')
      const [events, leave, priv, paidOut] = await Promise.all([
        fetchClockEvents(ids, earliestNeeded(year, today)),
        fetchAnnualLeave(ids, year),
        fetchStaffPrivateFields(),
        fetchPaidOut(ids, year),
      ])
      return { events, leave, priv, paidOut }
    },
  })

  const byId = useMemo(() => {
    if (!query.data) return {}
    const { events, leave, priv, paidOut } = query.data
    const eventsBy = groupBy(events, 'staff_id')
    const leaveBy  = groupBy(leave, 'staff_id')
    const paidBy   = groupBy(paidOut, 'staff_id')
    const now = new Date()
    const out = {}
    for (const s of zero) {
      out[s.id] = zeroHoursHoliday({
        region: holidayRegion,
        staff: { ...s, start_date: priv.get(s.id)?.start_date ?? s.start_date ?? null },
        events: eventsBy[s.id] ?? [],
        requests: leaveBy[s.id] ?? [],
        paidOut: paidBy[s.id] ?? [],
        year,
        today,
        now,
      })
    }
    return out
  }, [query.data, zero, holidayRegion, year, today])

  return {
    byId,
    loading: idsKey.length > 0 && query.isLoading,
    failed: query.isError,
    reload: () => queryClient.invalidateQueries({ queryKey: [HOLIDAY_BALANCES_KEY] }),
  }
}

function groupBy(rows, key) {
  const out = {}
  for (const r of rows) (out[r[key]] ??= []).push(r)
  return out
}

const NO_ROTA = {}

/**
 * Rota hours for these people between two dates, to suggest holiday pay from
 * the shift they were booked on. `{ [staffId]: { 'yyyy-MM-dd': hours } }`.
 */
export function useRotaHours(staffIds, from, to) {
  const { venueId } = useVenue()
  const { breakDurationMins } = useAppSettings()
  const idsKey = [...new Set(staffIds)].sort().join(',')
  const query = useQuery({
    queryKey: ['rota-hours', venueId, idsKey, from, to, breakDurationMins],
    enabled: !!venueId && idsKey.length > 0 && !!from && !!to,
    staleTime: 60_000,
    queryFn: () => fetchRotaHours(venueId, idsKey.split(','), from, to, { breakMins: breakDurationMins }),
  })
  return query.data ?? NO_ROTA
}

const NO_PAID_OUT = {}

/**
 * Holiday already paid outside dated bookings, per person, for `year`:
 * `{ [staffId]: { hours, days, rows } }`. Shares the balances' query-key prefix,
 * so invalidating HOLIDAY_BALANCES_KEY refreshes both.
 */
export function usePaidOut(staffIds, year) {
  const { venueId } = useVenue()
  const idsKey = [...new Set(staffIds.filter(Boolean))].sort().join(',')
  const query = useQuery({
    queryKey: [HOLIDAY_BALANCES_KEY, 'paid-out', venueId, idsKey, year],
    enabled: !!venueId && idsKey.length > 0,
    staleTime: 60_000,
    queryFn: () => fetchPaidOut(idsKey.split(','), year),
  })
  return useMemo(() => {
    if (!query.data) return NO_PAID_OUT
    const out = {}
    for (const r of query.data) {
      const p = (out[r.staff_id] ??= { hours: 0, days: 0, rows: [] })
      p.hours += Number(r.hours) || 0
      p.days  += Number(r.days) || 0
      p.rows.push(r)
    }
    return out
  }, [query.data])
}
