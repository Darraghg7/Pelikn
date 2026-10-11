import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { useAppSettings } from './useSettings'
import {
  fetchClockEvents, fetchAnnualLeave, fetchRotaHours, fetchPaidOut, fetchCarryOver, fetchEntitlementOverride,
  fetchFirstClockIns, fetchVenueFirstClockIn,
} from '../lib/api/holidayData'
import { fetchStaffPrivateFields } from '../lib/api/staffRestricted'
import { zeroHoursHoliday, NI_LOOKBACK_WEEKS } from '../lib/holiday'
import { holidayYearContaining, previousHolidayYear } from '../lib/holidayYear'
import { londonToday, londonDateStr } from '../lib/time'
import { calculateEntitlementDays, daysUsedInHolidayYear } from './useLeaveBalance'

export const HOLIDAY_BALANCES_KEY = 'holiday-balances'

/**
 * The holiday year containing today, from the venue's "holiday year starts in"
 * setting. Stable between renders, so it can sit in query keys and deps.
 */
export function useHolidayYear() {
  const { holidayYearStartMonth } = useAppSettings()
  const today = londonToday()
  return useMemo(() => holidayYearContaining(today, holidayYearStartMonth), [today, holidayYearStartMonth])
}

/** Earliest date needed: the start of the holiday year, or the NI look-back if that reaches further. */
function earliestNeeded(holidayYear, today) {
  const [y, m, d] = today.split('-').map(Number)
  const lookback = new Date(Date.UTC(y, m - 1, d - 7 * (NI_LOOKBACK_WEEKS + 1))).toISOString().slice(0, 10)
  return lookback < holidayYear.start ? lookback : holidayYear.start
}

/**
 * For NI staff with no start date saved: their first clock-in and the venue's,
 * so lib/holiday can tell a new starter from someone who was there before the
 * venue started using Pelikn. Nothing is read for GB or when every start date
 * is saved.
 */
async function fetchStartDateClues(region, venueId, staffIds) {
  if (region !== 'ni' || !staffIds.length) return { firstClockIns: {}, venueFirstClockIn: null }
  const [firstClockIns, venueFirstClockIn] = await Promise.all([
    fetchFirstClockIns(staffIds),
    fetchVenueFirstClockIn(venueId),
  ])
  return { firstClockIns, venueFirstClockIn }
}

/** zeroHoursHoliday's start-date guess inputs for one person, as London dates. */
function startDateClues(clues, staffId) {
  const first = clues.firstClockIns[staffId]
  return {
    firstClockIn: first ? londonDateStr(first) : null,
    venueFirstClockIn: clues.venueFirstClockIn ? londonDateStr(clues.venueFirstClockIn) : null,
  }
}

/**
 * Holiday positions for zero-hours staff, keyed by staff id. Anyone in
 * `staffList` who isn't zero-hours is skipped — their allowance is in days.
 *
 * Each entry is the result of lib/holiday's zeroHoursHoliday: check `status`
 * ('ok' | 'needs_region' | 'self_employed') before reading figures.
 *
 * @param {{id: string, employment_type?: string, working_days?: number[], holiday_pay_eligible?: boolean, start_date?: string|null}[]} staffList
 * @param {import('../lib/holidayYear').HolidayYear} holidayYear
 */
export function useHolidayBalances(staffList, holidayYear) {
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
    queryKey: [HOLIDAY_BALANCES_KEY, venueId, idsKey, holidayYear.start, holidayRegion],
    enabled: !!venueId && idsKey.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = idsKey.split(',')
      const [events, leave, priv, paidOut, carriedOver] = await Promise.all([
        fetchClockEvents(ids, earliestNeeded(holidayYear, today)),
        fetchAnnualLeave(ids, holidayYear),
        fetchStaffPrivateFields(),
        fetchPaidOut(ids, holidayYear.startYear),
        fetchCarryOver(ids, holidayYear.startYear),
      ])
      const noStartDate = zero.filter(s => !(priv.get(s.id)?.start_date ?? s.start_date)).map(s => s.id)
      const clues = await fetchStartDateClues(holidayRegion, venueId, noStartDate)
      return { events, leave, priv, paidOut, carriedOver, clues }
    },
  })

  const byId = useMemo(() => {
    if (!query.data) return {}
    const { events, leave, priv, paidOut, carriedOver, clues } = query.data
    const eventsBy = groupBy(events, 'staff_id')
    const leaveBy  = groupBy(leave, 'staff_id')
    const paidBy   = groupBy(paidOut, 'staff_id')
    const carryBy  = groupBy(carriedOver, 'staff_id')
    const now = new Date()
    const out = {}
    for (const s of zero) {
      out[s.id] = zeroHoursHoliday({
        region: holidayRegion,
        staff: { ...s, start_date: priv.get(s.id)?.start_date ?? s.start_date ?? null },
        events: eventsBy[s.id] ?? [],
        requests: leaveBy[s.id] ?? [],
        paidOut: paidBy[s.id] ?? [],
        carriedOver: carryBy[s.id] ?? [],
        holidayYear,
        today,
        now,
        ...startDateClues(clues, s.id),
      })
    }
    return out
  }, [query.data, zero, holidayRegion, holidayYear, today])

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
 * Holiday already paid outside dated bookings, per person, for the holiday
 * year starting in `leaveYear`: `{ [staffId]: { hours, days, rows } }`. Shares
 * the balances' query-key prefix, so invalidating HOLIDAY_BALANCES_KEY
 * refreshes both.
 */
export function usePaidOut(staffIds, leaveYear) {
  return useLeaveYearAmounts('paid-out', fetchPaidOut, staffIds, leaveYear)
}

/**
 * Holiday carried over into the holiday year starting in `leaveYear`
 * (migration 153), per person, shaped like usePaidOut.
 */
export function useCarryOver(staffIds, leaveYear) {
  return useLeaveYearAmounts('carry-over', fetchCarryOver, staffIds, leaveYear)
}

function useLeaveYearAmounts(kind, fetchRows, staffIds, leaveYear) {
  const { venueId } = useVenue()
  const idsKey = [...new Set(staffIds.filter(Boolean))].sort().join(',')
  const query = useQuery({
    queryKey: [HOLIDAY_BALANCES_KEY, kind, venueId, idsKey, leaveYear],
    enabled: !!venueId && idsKey.length > 0,
    staleTime: 60_000,
    queryFn: () => fetchRows(idsKey.split(','), leaveYear),
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

/**
 * What one person had left at the end of last holiday year — the suggestion
 * when a manager carries holiday over. Hours for zero-hours staff (`hours`),
 * days for everyone else (`days`); null while loading or when there is nothing
 * to suggest. Only fetched while `enabled`, as it reads up to two years of
 * clock-ins.
 */
export function useLastYearLeft(staff, holidayYear, enabled) {
  const { venueId } = useVenue()
  const { holidayRegion } = useAppSettings()
  const last = useMemo(() => previousHolidayYear(holidayYear), [holidayYear])
  const isZeroHours = staff?.employment_type === 'zero_hours'
  const query = useQuery({
    queryKey: [HOLIDAY_BALANCES_KEY, 'last-year-left', venueId, staff?.id, last.start, isZeroHours, holidayRegion],
    enabled: !!venueId && !!staff?.id && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = [staff.id]
      const [leave, paidOut, carriedOver, events, priv, entitlement] = await Promise.all([
        fetchAnnualLeave(ids, last),
        fetchPaidOut(ids, last.startYear),
        fetchCarryOver(ids, last.startYear),
        isZeroHours ? fetchClockEvents(ids, earliestNeeded(last, last.end)) : [],
        isZeroHours ? fetchStaffPrivateFields() : null,
        isZeroHours ? null : fetchEntitlementOverride(staff.id, last.startYear),
      ])
      const hasStartDate = !!(priv?.get(staff.id)?.start_date ?? staff.start_date)
      const clues = await fetchStartDateClues(isZeroHours ? holidayRegion : null, venueId, hasStartDate ? [] : ids)
      return { leave, paidOut, carriedOver, events, priv, entitlement, clues }
    },
  })
  return useMemo(() => {
    if (!query.data || !staff) return null
    const { leave, paidOut, carriedOver, events, priv, entitlement, clues } = query.data
    if (isZeroHours) {
      const h = zeroHoursHoliday({
        region: holidayRegion,
        staff: { ...staff, start_date: priv?.get(staff.id)?.start_date ?? staff.start_date ?? null },
        events, requests: leave, paidOut, carriedOver,
        holidayYear: last, today: last.end, now: new Date(),
        ...startDateClues(clues, staff.id),
      })
      return h.status === 'ok' ? { hours: Math.max(0, h.balance), yearLabel: last.label } : null
    }
    if (staff.holiday_pay_eligible === false) return null
    const allowance = entitlement ?? calculateEntitlementDays(staff.employment_type, staff.working_days)
    if (allowance == null) return null
    const used = daysUsedInHolidayYear(leave, last, staff.working_days) + sumOf(paidOut, 'days')
    return { days: Math.max(0, allowance + sumOf(carriedOver, 'days') - used), yearLabel: last.label }
  }, [query.data, staff, isZeroHours, holidayRegion, last])
}

const sumOf = (rows, key) => rows.reduce((sum, r) => sum + (Number(r[key]) || 0), 0)
