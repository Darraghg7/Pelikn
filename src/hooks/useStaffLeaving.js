import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { useSession } from '../contexts/SessionContext'
import { useAppSettings } from './useSettings'
import { fetchVenueLeavers, fetchEntitlementOverride } from '../lib/api/staffLeaving'
import { fetchClockEvents, fetchAnnualLeave, fetchPaidOut } from '../lib/api/holidayData'
import { fetchStaffPayRates, fetchStaffPrivateFields } from '../lib/api/staffRestricted'
import { leaverHolidayHours, leaverHolidayDays, leaverHolidayPay } from '../lib/leaving'
import { calculateEntitlementDays } from './useLeaveBalance'
import { NI_LOOKBACK_WEEKS } from '../lib/holiday'
import { londonToday } from '../lib/time'

export const STAFF_LEAVING_KEY = 'staff-leaving'

/**
 * Who is leaving (or has left) this venue, keyed by staff id. Managers only;
 * for anyone else the query doesn't run and the map is empty.
 */
export function useStaffLeaving() {
  const { venueId } = useVenue()
  const { isManager } = useSession()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: [STAFF_LEAVING_KEY, venueId],
    enabled: !!venueId && isManager,
    staleTime: 60_000,
    queryFn: () => fetchVenueLeavers(venueId),
  })
  const byId = useMemo(() => {
    const out = {}
    for (const r of query.data?.rows ?? []) out[r.staff_id] = r
    return out
  }, [query.data])
  return {
    byId,
    missing: !!query.data?.missing,
    loading: query.isLoading && query.fetchStatus !== 'idle',
    reload: () => queryClient.invalidateQueries({ queryKey: [STAFF_LEAVING_KEY] }),
  }
}

function minusWeeks(dateStr, weeks) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 7 * weeks)).toISOString().slice(0, 10)
}

/**
 * Final holiday position for one leaver, plus what it is worth in pounds.
 *
 * @param {{id: string, employment_type?: string, working_days?: number[], holiday_pay_eligible?: boolean}|null} staff
 * @param {string|null} lastDay  "yyyy-MM-dd"
 */
export function useLeaverHoliday(staff, lastDay) {
  const { venueId } = useVenue()
  const { holidayRegion } = useAppSettings()
  const zeroHours = staff?.employment_type === 'zero_hours'
  const year = lastDay ? Number(lastDay.slice(0, 4)) : null

  const query = useQuery({
    queryKey: [STAFF_LEAVING_KEY, 'holiday', venueId, staff?.id, lastDay, zeroHours],
    enabled: !!venueId && !!staff?.id && !!lastDay,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = [staff.id]
      const yearStart = `${year}-01-01`
      const lookback = minusWeeks(lastDay, NI_LOOKBACK_WEEKS + 1)
      const [events, leave, paidOut, priv, rates, override] = await Promise.all([
        zeroHours ? fetchClockEvents(ids, lookback < yearStart ? lookback : yearStart) : [],
        fetchAnnualLeave(ids, year),
        fetchPaidOut(ids, year),
        fetchStaffPrivateFields(),
        fetchStaffPayRates(),
        zeroHours ? null : fetchEntitlementOverride(staff.id, year),
      ])
      return { events, leave, paidOut, priv: priv.get(staff.id) ?? {}, rate: rates.get(staff.id) ?? null, override }
    },
  })

  const today = londonToday()
  const result = useMemo(() => {
    if (!query.data || !staff || !lastDay) return null
    const { events, leave, paidOut, priv, rate, override } = query.data
    const startDate = priv.start_date ?? null
    const workingDays = staff.working_days ?? []
    const position = zeroHours
      ? leaverHolidayHours({
          region: holidayRegion,
          staff: { ...staff, start_date: startDate },
          events, requests: leave, paidOut, lastDay, today, now: new Date(),
        })
      : leaverHolidayDays({
          entitlementDays: staff.holiday_pay_eligible === false
            ? null
            : (override ?? calculateEntitlementDays(staff.employment_type, workingDays)),
          requests: leave, paidOut, workingDays, startDate, lastDay,
        })
    const pay = leaverHolidayPay(position, { hourlyRate: rate, contractedHours: priv.contracted_hours, workingDays })
    return { position, pay, hourlyRate: rate }
  }, [query.data, staff, lastDay, zeroHours, holidayRegion, today])

  return { ...(result ?? {}), loading: query.isLoading, failed: query.isError }
}
