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
import { fetchTimeOffPrivateFields, withTimeOffPrivate } from '../lib/api/timeOffPrivate'
import { calculateEntitlementDays, countWorkingDaysInRequest } from './useLeaveBalance'

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
        .select('id, staff_id, venue_id, start_date, end_date, status, leave_type, reviewed_by, reviewed_at, cancelled_at, cancelled_by, created_at, staff:staff_id(name, working_days), reviewer:reviewed_by(name)')
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
      .then(({ data }) => setStaff(data ?? []))
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
      .then(({ data }) => setProfile(data))
  }, [staffId])
  return profile
}

// Compute all staff leave balances in a single batch fetch
export function useTeamLeaveBalances(staff, leaveYear) {
  const year = leaveYear ?? new Date().getFullYear()
  const [approvedReqs, setApprovedReqs] = useState([])
  const [overrides, setOverrides]       = useState({})
  const [loading, setLoading]           = useState(true)
  const [tick, setTick]                 = useState(0)

  useEffect(() => {
    if (!staff.length) { setLoading(false); return }
    const ids = staff.map(s => s.id)
    Promise.all([
      supabase.from('time_off_requests')
        .select('staff_id, start_date, end_date')
        .in('staff_id', ids)
        .eq('status', 'approved')
        .eq('leave_type', 'annual')
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`),
      supabase.from('leave_entitlements')
        .select('staff_id, override_days')
        .in('staff_id', ids)
        .eq('leave_year', year),
    ]).then(([reqRes, ovRes]) => {
      setApprovedReqs(reqRes.data ?? [])
      const map = {}
      for (const o of (ovRes.data ?? [])) map[o.staff_id] = o.override_days
      setOverrides(map)
      setLoading(false)
    })
  }, [staff.length, year, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const reloadBalances = useCallback(() => setTick(t => t + 1), [])

  const balances = useMemo(() => staff.map(s => {
    const eligible    = s.holiday_pay_eligible !== false
    const calculated  = eligible ? calculateEntitlementDays(s.employment_type, s.working_days) : null
    const entitlement = eligible ? (overrides[s.id] ?? calculated) : null
    const myReqs      = approvedReqs.filter(r => r.staff_id === s.id)
    const used        = myReqs.reduce((sum, r) =>
      sum + countWorkingDaysInRequest(r.start_date, r.end_date, s.working_days), 0)
    const remaining   = entitlement != null ? Math.max(0, entitlement - used) : null
    return { ...s, entitlement, used, remaining, isZeroHours: s.employment_type === 'zero_hours', isEligible: eligible }
  }), [staff, approvedReqs, overrides])

  return { balances, loading, reloadBalances }
}
