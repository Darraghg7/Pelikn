import { useEffect, useState } from 'react'
import { parseISO, getDay, eachDayOfInterval } from 'date-fns'
import { supabase } from '../lib/supabase'

// Round to nearest 0.5 day
function roundHalf(n) {
  return Math.round(n * 2) / 2
}

// Count days in a leave request that fall on the staff member's contracted working pattern
export function countWorkingDaysInRequest(startDate, endDate, workingDays) {
  // workingDays: array of 1-7 (Mon=1…Sun=7); empty means Mon–Fri
  const pattern = workingDays?.length > 0 ? workingDays : [1, 2, 3, 4, 5]
  try {
    const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
    return days.filter(d => {
      const dow = getDay(d) // 0=Sun
      const mapped = dow === 0 ? 7 : dow // normalise to 1=Mon…7=Sun
      return pattern.includes(mapped)
    }).length
  } catch {
    return 0
  }
}

// Calculate statutory annual leave entitlement in days (UK: 5.6 weeks).
// Returns null for zero-hours workers (accrual-based, tracked separately).
export function calculateEntitlementDays(employment_type, working_days) {
  if (employment_type === 'zero_hours') return null
  const daysPerWeek = working_days?.length > 0 ? Math.min(working_days.length, 7) : 5
  return roundHalf(5.6 * daysPerWeek)
}

// Hook: computes leave balance for one staff member for a given calendar year.
// staff: { id, employment_type, working_days }
export function useLeaveBalance(staff, leaveYear) {
  const year = leaveYear ?? new Date().getFullYear()
  const [overrideDays, setOverrideDays] = useState(null)
  const [usedDays, setUsedDays]         = useState(0)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!staff?.id) { setLoading(false); return }
    let cancelled = false

    const run = async () => {
      setLoading(true)

      // Check for a manager-set entitlement override
      const { data: entRow } = await supabase
        .from('leave_entitlements')
        .select('override_days')
        .eq('staff_id', staff.id)
        .eq('leave_year', year)
        .maybeSingle()

      // Count approved annual leave days taken this year
      const { data: reqs } = await supabase
        .from('time_off_requests')
        .select('start_date, end_date')
        .eq('staff_id', staff.id)
        .eq('status', 'approved')
        .eq('leave_type', 'annual')
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`)

      if (cancelled) return

      setOverrideDays(entRow?.override_days ?? null)
      setUsedDays(
        (reqs ?? []).reduce(
          (sum, r) => sum + countWorkingDaysInRequest(r.start_date, r.end_date, staff.working_days),
          0
        )
      )
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [staff?.id, staff?.employment_type, year])

  const eligible     = staff?.holiday_pay_eligible !== false
  const calculated   = eligible ? calculateEntitlementDays(staff?.employment_type, staff?.working_days) : null
  const entitlement  = eligible ? (overrideDays ?? calculated) : null
  const remaining    = entitlement != null ? Math.max(0, entitlement - usedDays) : null

  return {
    loading,
    entitlement,              // total days (null for zero-hours or ineligible)
    used: usedDays,
    remaining,                // null for zero-hours or ineligible
    isZeroHours: staff?.employment_type === 'zero_hours',
    isEligible: eligible,
    isOverridden: overrideDays !== null,
    leaveYear: year,
  }
}
