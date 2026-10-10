/**
 * Data hooks backing the time-off screens.
 *
 * These still use raw supabase.from() calls rather than lib/api + React
 * Query. That is deliberate for now — they were lifted verbatim out of
 * TimeOffPage.jsx so the move stays reviewable as a pure relocation.
 * Converting them to the React Query pattern is a separate change.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/reportError'
import { fetchTimeOffPrivateFields, withTimeOffPrivate } from '../lib/api/timeOffPrivate'
import { calculateEntitlementDays } from './useLeaveBalance'
import { fetchHolidayAllocations, leaveDaysInRange } from '../lib/api/holidayPay'

export function useTimeOffRequests(venueId) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    setError(null)
    // Was select('*'). 119 withholds reason/manager_note, and a star select
    // asks for every column — so it fails the whole query rather than omitting
    // them. Columns are named explicitly and the two are merged back below.
    const [{ data, error: err }, priv] = await Promise.all([
      supabase
        .from('time_off_requests')
        .select('id, staff_id, venue_id, start_date, end_date, status, leave_type, reviewed_by, reviewed_at, cancelled_at, cancelled_by, created_at, staff:staff_id(name, working_days, colour, photo_url), reviewer:reviewed_by(name)')
        .eq('venue_id', venueId)
        .order('start_date', { ascending: true }),
      fetchTimeOffPrivateFields(),
    ])
    if (err) { setError(err.message); setLoading(false); return }
    setRequests(withTimeOffPrivate(data ?? [], priv))
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { requests, loading, error, reload: load }
}

export function useActiveStaff(venueId) {
  const [staff, setStaff] = useState([])
  useEffect(() => {
    if (!venueId) return
    supabase.from('staff')
      .select('id, name, employment_type, working_days, holiday_pay_eligible')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) { reportError(error, 'useActiveStaff'); return }
        setStaff(data ?? [])
      })
  }, [venueId])
  return staff
}

export function useOwnProfile(staffId) {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    if (!staffId) return
    supabase.from('staff')
      .select('id, employment_type, working_days, holiday_pay_eligible')
      .eq('id', staffId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { reportError(error, 'useOwnProfile'); return }
        setProfile(data)
      })
  }, [staffId])
  return profile
}

// Compute all staff leave balances in a single batch fetch.
// leaveYear: { startYear, from, to } from lib/leaveYear. Leave that runs
// across the start or end of the holiday year only counts the days inside it.
export function useTeamLeaveBalances(staff, leaveYear) {
  const { startYear, from, to } = leaveYear
  const [approvedReqs, setApprovedReqs] = useState([])
  const [overrides, setOverrides]       = useState({})
  const [allocations, setAllocations]   = useState([])
  const [allocationsAvailable, setAllocationsAvailable] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [failed, setFailed]             = useState(false)
  const [tick, setTick]                 = useState(0)

  // Keyed on the ids themselves, not staff.length: a venue switch or a
  // leaver-plus-joiner keeps the count the same but needs a fresh fetch.
  // (Callers also pass a new [] each render, so the array can't be the key.)
  const idsKey = staff.map(s => s.id).join(',')
  const ids    = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey])

  useEffect(() => {
    if (!ids.length) { setLoading(false); return }
    let cancelled = false
    Promise.all([
      supabase.from('time_off_requests')
        .select('id, staff_id, start_date, end_date')
        .in('staff_id', ids)
        .eq('status', 'approved')
        .eq('leave_type', 'annual')
        .lte('start_date', to)
        .gte('end_date', from),
      supabase.from('leave_entitlements')
        .select('staff_id, override_days')
        .in('staff_id', ids)
        .eq('leave_year', startYear),
      // Allocated hours only refine the zero-hours figure — if they can't be
      // read (148 not applied yet) the balance estimates instead of failing.
      fetchHolidayAllocations({ staffIds: ids, from, to })
        .catch((e) => { reportError(e, 'useTeamLeaveBalances:allocations'); return { data: [], available: false } }),
    ]).then(([reqRes, ovRes, allocRes]) => {
      if (cancelled) return
      // Without both reads every balance would show as a full, untouched
      // allowance — so fail the list instead of showing wrong numbers.
      const error = reqRes.error ?? ovRes.error
      setFailed(!!error)
      if (error) { reportError(error, 'useTeamLeaveBalances'); setLoading(false); return }
      setApprovedReqs(reqRes.data ?? [])
      const map = {}
      for (const o of (ovRes.data ?? [])) map[o.staff_id] = o.override_days
      setOverrides(map)
      setAllocations(allocRes.data)
      setAllocationsAvailable(allocRes.available)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [ids, startYear, from, to, tick])

  const reloadBalances = useCallback(() => setTick(t => t + 1), [])

  const balances = useMemo(() => staff.map(s => {
    const eligible    = s.holiday_pay_eligible !== false
    const calculated  = eligible ? calculateEntitlementDays(s.employment_type, s.working_days) : null
    const entitlement = eligible ? (overrides[s.id] ?? calculated) : null
    const myReqs      = approvedReqs.filter(r => r.staff_id === s.id)
    const leaveDays   = leaveDaysInRange(myReqs, allocations, s.working_days, from, to)
    const used        = leaveDays.filter(d => d.isWorkingDay).length
    const remaining   = entitlement != null ? Math.max(0, entitlement - used) : null
    return {
      ...s, entitlement, used, remaining, leaveDays,
      isZeroHours: s.employment_type === 'zero_hours', isEligible: eligible,
    }
  }), [staff, approvedReqs, overrides, allocations, from, to])

  return { balances, loading, failed, reloadBalances, allocationsAvailable }
}
