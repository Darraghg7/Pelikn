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
import { calculateEntitlementDays, countWorkingDaysInRequest } from './useLeaveBalance'
import { hasHoursColumn } from '../lib/api/holidayPay'

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
    // hours only once migration 148 has added it
    const withHours = await hasHoursColumn()
    /** @type {string} */
    const columns = 'id, staff_id, venue_id, start_date, end_date, status, leave_type, reviewed_by, reviewed_at, cancelled_at, cancelled_by, created_at, ' +
      (withHours ? 'hours, ' : '') +
      'staff:staff_id(name, employment_type, working_days, colour, photo_url), reviewer:reviewed_by(name)'
    const [{ data, error: err }, priv] = await Promise.all([
      supabase
        .from('time_off_requests')
        .select(columns)
        .eq('venue_id', venueId)
        .order('start_date', { ascending: true }),
      fetchTimeOffPrivateFields(),
    ])
    if (err) { setError(err.message); setLoading(false); return }
    setRequests(withTimeOffPrivate(/** @type {any[]} */ (data ?? []), priv))
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
//
// Each balance carries its approved and pending annual leave requests (with
// their booked hours, once migration 148 is applied) and any carry-over, so
// zero-hours balances can be worked out in hours by the caller.
export function useTeamLeaveBalances(staff, leaveYear) {
  const { startYear, from, to } = leaveYear
  const [annualReqs, setAnnualReqs] = useState([])
  const [entitlements, setEntitlements] = useState({})
  const [loading, setLoading]       = useState(true)
  const [failed, setFailed]         = useState(false)
  const [tick, setTick]             = useState(0)

  // Keyed on the ids themselves, not staff.length: a venue switch or a
  // leaver-plus-joiner keeps the count the same but needs a fresh fetch.
  // (Callers also pass a new [] each render, so the array can't be the key.)
  const idsKey = staff.map(s => s.id).join(',')
  const ids    = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey])

  useEffect(() => {
    if (!ids.length) { setLoading(false); return }
    let cancelled = false
    hasHoursColumn().then((withHours) => Promise.all([
      supabase.from('time_off_requests')
        .select(withHours ? 'id, staff_id, start_date, end_date, status, hours' : 'id, staff_id, start_date, end_date, status')
        .in('staff_id', ids)
        .in('status', ['approved', 'pending'])
        .eq('leave_type', 'annual')
        .lte('start_date', to)
        .gte('end_date', from),
      supabase.from('leave_entitlements')
        .select(withHours ? 'staff_id, override_days, carry_over_hours' : 'staff_id, override_days')
        .in('staff_id', ids)
        .eq('leave_year', startYear),
    ])).then(([reqRes, entRes]) => {
      if (cancelled) return
      // Without both reads every balance would show as a full, untouched
      // allowance — so fail the list instead of showing wrong numbers.
      const error = reqRes.error ?? entRes.error
      setFailed(!!error)
      if (error) { reportError(error, 'useTeamLeaveBalances'); setLoading(false); return }
      setAnnualReqs(reqRes.data ?? [])
      const map = {}
      for (const e of (entRes.data ?? [])) map[e.staff_id] = e
      setEntitlements(map)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [ids, startYear, from, to, tick])

  const reloadBalances = useCallback(() => setTick(t => t + 1), [])

  const balances = useMemo(() => staff.map(s => {
    const eligible    = s.holiday_pay_eligible !== false
    const calculated  = eligible ? calculateEntitlementDays(s.employment_type, s.working_days) : null
    const ent         = entitlements[s.id]
    const entitlement = eligible ? (ent?.override_days ?? calculated) : null
    const mine        = annualReqs.filter(r => r.staff_id === s.id)
    const approved    = mine.filter(r => r.status === 'approved')
    const pending     = mine.filter(r => r.status === 'pending')
    // Days of approved leave inside the holiday year, on their working pattern
    const used = approved.reduce((sum, r) => sum + countWorkingDaysInRequest(
      r.start_date < from ? from : r.start_date,
      r.end_date   > to   ? to   : r.end_date,
      s.working_days,
    ), 0)
    const remaining   = entitlement != null ? Math.max(0, entitlement - used) : null
    return {
      ...s, entitlement, used, remaining,
      approvedRequests: approved, pendingRequests: pending,
      carriedOver: Number(ent?.carry_over_hours ?? 0),
      isZeroHours: s.employment_type === 'zero_hours', isEligible: eligible,
    }
  }), [staff, annualReqs, entitlements, from, to])

  return { balances, loading, failed, reloadBalances }
}
