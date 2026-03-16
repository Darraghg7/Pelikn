import { format } from 'date-fns'
import { shiftDurationHours } from '../hooks/useShifts'

/**
 * Constraint-based rota builder — pure function, no React, no API calls.
 *
 * @param {Object} config
 * @param {Array}  config.staff              — [{ id, name, job_role, hourly_rate, contracted_hours }]
 * @param {Array}  config.days               — [Date, Date, ...] (7 dates for the week)
 * @param {Object} config.unavailability     — { "staffId:yyyy-MM-dd": { type } }
 * @param {Array}  config.existingShifts     — current shifts for the week
 * @param {string} config.weekStart          — formatted "yyyy-MM-dd"
 * @param {Object} config.preferences
 * @param {string} config.preferences.mode           — 'fill_gaps' | 'rebuild'
 * @param {number} config.preferences.minStaffPerDay
 * @param {number} config.preferences.maxStaffPerDay
 * @param {Array}  config.preferences.requiredRoles  — [{ role, min }]
 * @param {string} config.preferences.defaultStart   — "HH:mm"
 * @param {string} config.preferences.defaultEnd     — "HH:mm"
 * @param {number} config.preferences.targetHours    — fallback weekly target hours
 * @returns {{ generatedShifts, warnings, stats }}
 */
export function buildRota(config) {
  const { staff, days, unavailability, existingShifts, weekStart, preferences } = config
  const {
    mode = 'fill_gaps',
    minStaffPerDay = 2,
    maxStaffPerDay = staff.length,
    requiredRoles = [],
    defaultStart = '09:00',
    defaultEnd = '17:00',
    targetHours = 40,
  } = preferences

  const defaultShiftHours = shiftDurationHours(defaultStart, defaultEnd)
  const warnings = []
  const generated = []

  // Track hours assigned per staff member
  const hoursAssigned = {}
  for (const s of staff) {
    hoursAssigned[s.id] = 0
  }

  // Track shifts per day per staff (to avoid double-assigning)
  const assignedPerDay = {} // "dayIdx" → Set of staff IDs

  for (let di = 0; di < days.length; di++) {
    assignedPerDay[di] = new Set()
  }

  // If fill_gaps, account for existing shifts
  if (mode === 'fill_gaps') {
    for (const sh of existingShifts) {
      const hrs = shiftDurationHours(sh.start_time, sh.end_time)
      if (hoursAssigned[sh.staff_id] !== undefined) {
        hoursAssigned[sh.staff_id] += hrs
      }
      const dayIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === sh.shift_date)
      if (dayIdx >= 0) {
        assignedPerDay[dayIdx].add(sh.staff_id)
      }
    }
  }

  // Build availability matrix
  const isAvailable = (staffId, dayIdx) => {
    const dateStr = format(days[dayIdx], 'yyyy-MM-dd')
    const key = `${staffId}:${dateStr}`
    return !unavailability[key]
  }

  // Helper: get available staff for a day, sorted by fewest hours (fairness)
  const getAvailableStaff = (dayIdx, roleFilter = null) => {
    return staff
      .filter(s => {
        if (!isAvailable(s.id, dayIdx)) return false
        if (assignedPerDay[dayIdx].has(s.id)) return false
        if (roleFilter && s.job_role?.toLowerCase() !== roleFilter.toLowerCase()) return false
        return true
      })
      .sort((a, b) => (hoursAssigned[a.id] ?? 0) - (hoursAssigned[b.id] ?? 0))
  }

  const assignShift = (staffMember, dayIdx, role) => {
    const dateStr = format(days[dayIdx], 'yyyy-MM-dd')
    generated.push({
      staff_id: staffMember.id,
      shift_date: dateStr,
      week_start: weekStart,
      start_time: defaultStart,
      end_time: defaultEnd,
      role_label: role || staffMember.job_role || 'Staff',
      _staffName: staffMember.name, // for preview display only
    })
    hoursAssigned[staffMember.id] += defaultShiftHours
    assignedPerDay[dayIdx].add(staffMember.id)
  }

  // ── Pass 1: Role fulfillment ──────────────────────────────────────────
  for (let di = 0; di < days.length; di++) {
    for (const req of requiredRoles) {
      if (req.min <= 0) continue

      // Count already-filled slots for this role on this day
      let filled = 0
      if (mode === 'fill_gaps') {
        const dateStr = format(days[di], 'yyyy-MM-dd')
        filled = existingShifts.filter(
          sh => sh.shift_date === dateStr &&
                sh.role_label?.toLowerCase() === req.role.toLowerCase()
        ).length
      }

      const needed = req.min - filled
      if (needed <= 0) continue

      const candidates = getAvailableStaff(di, req.role)
      for (let i = 0; i < needed && i < candidates.length; i++) {
        assignShift(candidates[i], di, req.role)
      }

      if (candidates.length < needed) {
        warnings.push({
          type: 'role_unfilled',
          day: format(days[di], 'EEE d MMM'),
          role: req.role,
          message: `Could not fill ${needed - candidates.length} ${req.role} slot(s) on ${format(days[di], 'EEE d MMM')} — no available staff with that role`,
        })
      }
    }
  }

  // ── Pass 2: Minimum staffing ──────────────────────────────────────────
  for (let di = 0; di < days.length; di++) {
    const currentCount = assignedPerDay[di].size
    const needed = minStaffPerDay - currentCount
    if (needed <= 0) continue

    const candidates = getAvailableStaff(di)
    for (let i = 0; i < needed && i < candidates.length; i++) {
      assignShift(candidates[i], di, candidates[i].job_role || 'Staff')
    }

    if (candidates.length < needed) {
      warnings.push({
        type: 'understaffed',
        day: format(days[di], 'EEE d MMM'),
        message: `Only ${currentCount + Math.min(candidates.length, needed)} staff available on ${format(days[di], 'EEE d MMM')} (target: ${minStaffPerDay})`,
      })
    }
  }

  // ── Pass 3: Hours balancing ───────────────────────────────────────────
  for (const s of staff) {
    const target = s.contracted_hours > 0 ? Number(s.contracted_hours) : targetHours
    if (hoursAssigned[s.id] >= target) continue

    // Find days where this staff member is available, not yet assigned, and under max
    for (let di = 0; di < days.length; di++) {
      if (hoursAssigned[s.id] >= target) break
      if (!isAvailable(s.id, di)) continue
      if (assignedPerDay[di].has(s.id)) continue
      if (assignedPerDay[di].size >= maxStaffPerDay) continue

      assignShift(s, di, s.job_role || 'Staff')
    }

    if (hoursAssigned[s.id] < target) {
      warnings.push({
        type: 'under_hours',
        staff_id: s.id,
        name: s.name,
        targetHours: target,
        assignedHours: hoursAssigned[s.id],
        message: `${s.name} assigned ${hoursAssigned[s.id].toFixed(1)}h (target: ${target}h) — not enough available days`,
      })
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  const totalHours = generated.length * defaultShiftHours
  const estimatedCost = generated.reduce((sum, sh) => {
    const member = staff.find(s => s.id === sh.staff_id)
    return sum + defaultShiftHours * (member?.hourly_rate ?? 0)
  }, 0)

  const staffHoursBreakdown = staff
    .map(s => ({
      staffId: s.id,
      name: s.name,
      existingHours: mode === 'fill_gaps'
        ? existingShifts
            .filter(sh => sh.staff_id === s.id)
            .reduce((acc, sh) => acc + shiftDurationHours(sh.start_time, sh.end_time), 0)
        : 0,
      newHours: generated
        .filter(sh => sh.staff_id === s.id).length * defaultShiftHours,
    }))
    .filter(s => s.existingHours > 0 || s.newHours > 0)

  return {
    generatedShifts: generated,
    warnings,
    stats: {
      totalShiftsCreated: generated.length,
      totalHours,
      estimatedCost,
      staffHoursBreakdown,
    },
  }
}
