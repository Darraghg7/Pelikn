import { format } from 'date-fns'
import { shiftDurationHours, paidShiftHours } from '../hooks/useShifts'

const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * Requirement-based rota filler — pure function, no React, no API calls.
 * Uses rota_requirements (role+time+count per day_of_week) and staff role
 * assignments to fill shifts greedily with fairness (fewest shifts first).
 *
 * @param {Object}   config
 * @param {Array}    config.requirements   — [{ day_of_week, role_name, staff_count, start_time, end_time }]
 * @param {Array}    config.staff          — [{ id, name }]
 * @param {Object}   config.staffRoles     — Record<staffId, roleName[]>
 * @param {Object}   config.unavailability — { "staffId:yyyy-MM-dd": { type, subtype? } }
 * @param {Array}    config.existingShifts — current shifts for the week
 * @param {string}   config.weekStart      — "yyyy-MM-dd" (Monday)
 * @param {string}   config.mode           — 'fill_gaps' | 'rebuild'
 * @param {number[]} config.closedDays     — 0-based day indices to skip (0=Mon)
 * @returns {{ shifts, gaps, meta }}
 */
export function fillRotaRequirements({
  requirements = [],
  staff = [],
  staffRoles = {},
  unavailability = {},
  existingShifts = [],
  weekStart,
  mode = 'fill_gaps',
  closedDays = [],
  crossVenueShifts = [],
}) {
  // Build week date strings Mon–Sun
  const weekDates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    weekDates.push(d.toISOString().slice(0, 10))
  }

  // Track shifts assigned this week per staff (fairness counter)
  const shiftsAssigned = {}
  for (const s of staff) shiftsAssigned[s.id] = 0

  // Track who's already assigned on each date (no double-booking)
  const assignedOnDate = {}
  for (const dateStr of weekDates) assignedOnDate[dateStr] = new Set()

  // In fill_gaps: pre-load existing shift counts
  if (mode === 'fill_gaps') {
    for (const sh of existingShifts) {
      if (shiftsAssigned[sh.staff_id] !== undefined) shiftsAssigned[sh.staff_id]++
      if (assignedOnDate[sh.shift_date]) assignedOnDate[sh.shift_date].add(sh.staff_id)
    }
  }

  const isAvailable = (staffId, dateStr) => {
    const key = `${staffId}:${dateStr}`
    const entry = unavailability[key]
    if (!entry) return true
    if (entry.type === 'time_off') return false
    if (entry.type === 'manual') return false
    return false
  }

  // Cross-venue conflict: linked staff already rostered at another venue that day
  const hasCrossVenueConflict = (staffId, dateStr) =>
    crossVenueShifts.some(cs => cs.staff_id === staffId && cs.shift_date === dateStr)

  const shifts = []
  const gaps = []

  for (let di = 0; di < 7; di++) {
    if (closedDays.includes(di)) continue
    const dateStr = weekDates[di]
    const dow = di + 1 // 1=Mon … 7=Sun

    const dayReqs = requirements.filter(r => r.day_of_week === dow)

    for (const req of dayReqs) {
      const roleName  = req.role_name
      const start     = (req.start_time ?? '09:00').slice(0, 5)
      const end       = (req.end_time   ?? '17:00').slice(0, 5)
      const count     = req.staff_count ?? 1

      // fill_gaps: count existing shifts already covering this exact slot
      let alreadyFilled = 0
      if (mode === 'fill_gaps') {
        alreadyFilled = existingShifts.filter(sh =>
          sh.shift_date === dateStr &&
          (sh.role_label ?? '').toLowerCase() === roleName.toLowerCase() &&
          (sh.start_time ?? '').slice(0, 5) === start &&
          (sh.end_time   ?? '').slice(0, 5) === end
        ).length
      }

      const needed = count - alreadyFilled
      if (needed <= 0) continue

      for (let slot = 0; slot < needed; slot++) {
        const candidates = staff
          .filter(s => {
            if (!isAvailable(s.id, dateStr)) return false
            if (assignedOnDate[dateStr].has(s.id)) return false
            if (hasCrossVenueConflict(s.id, dateStr)) return false
            const roles = staffRoles[s.id] ?? []
            return roles.some(r => r.toLowerCase() === roleName.toLowerCase())
          })
          .sort((a, b) => {
            const diff = (shiftsAssigned[a.id] ?? 0) - (shiftsAssigned[b.id] ?? 0)
            return diff !== 0 ? diff : a.name.localeCompare(b.name)
          })

        if (candidates.length === 0) {
          const anyAvailable = staff.some(
            s => isAvailable(s.id, dateStr) && !assignedOnDate[dateStr].has(s.id)
          )
          gaps.push({
            shift_date: dateStr,
            day_name:   DAY_NAMES_FULL[di],
            start_time: start,
            end_time:   end,
            role_label: roleName,
            reason: anyAvailable
              ? `No staff with '${roleName}' role available`
              : 'No available staff',
          })
        } else {
          const chosen = candidates[0]
          shifts.push({
            staff_id:   chosen.id,
            staff_name: chosen.name, // stripped before DB insert
            shift_date: dateStr,
            start_time: start,
            end_time:   end,
            role_label: roleName,
          })
          shiftsAssigned[chosen.id]++
          assignedOnDate[dateStr].add(chosen.id)
        }
      }
    }
  }

  return {
    shifts,
    gaps,
    meta: {
      slotsRequested: shifts.length + gaps.length,
      shiftsFilled:   shifts.length,
      gapCount:       gaps.length,
    },
  }
}

/**
 * Constraint-based rota builder — pure function, no React, no API calls.
 *
 * @param {Object} config
 * @param {Array}  config.staff              — [{ id, name, job_role, hourly_rate, skills }]
 * @param {Array}  config.days               — [Date, Date, ...] (7 dates for the week)
 * @param {Object} config.unavailability     — { "staffId:yyyy-MM-dd": { type, subtype? } }
 * @param {Array}  config.existingShifts     — current shifts for the week
 * @param {string} config.weekStart          — formatted "yyyy-MM-dd"
 * @param {Object} config.preferences
 * @param {string} config.preferences.mode           — 'fill_gaps' | 'rebuild'
 * @param {number} config.preferences.minStaffPerDay
 * @param {number} config.preferences.maxStaffPerDay
 * @param {Array}  config.preferences.requiredRoles  — [{ role, min }]
 * @param {Array}  config.preferences.requiredSkills — [{ skill, min }]
 * @param {string} config.preferences.defaultStart   — "HH:mm"
 * @param {string} config.preferences.defaultEnd     — "HH:mm"
 * @param {Array}  config.preferences.closedDays     — [0, 1, ...] day indices to skip (0=Mon)
 * @returns {{ generatedShifts, warnings, stats }}
 */
export function buildRota(config) {
  const { staff, days, unavailability, existingShifts, weekStart, preferences, breakDurationMins = 30 } = config
  const {
    mode = 'fill_gaps',
    minStaffPerDay = 2,
    maxStaffPerDay = staff.length,
    requiredRoles = [],
    requiredSkills = [],
    defaultStart = '09:00',
    defaultEnd = '17:00',
    closedDays = [],
  } = preferences

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

  // Build availability matrix — break_cover staff are only available for break cover shifts
  const isAvailable = (staffId, dayIdx, includeBreakCover = false) => {
    const dateStr = format(days[dayIdx], 'yyyy-MM-dd')
    const key = `${staffId}:${dateStr}`
    const entry = unavailability[key]
    if (!entry) return true // fully available
    if (entry.type === 'time_off') return false
    if (entry.type === 'manual') {
      if (entry.subtype === 'break_cover') return includeBreakCover
      return false // unavailable
    }
    return false
  }

  // Helper: get available staff for a day, sorted by fewest hours (fairness)
  const getAvailableStaff = (dayIdx, { roleFilter = null, skillFilter = null, includeBreakCover = false } = {}) => {
    return staff
      .filter(s => {
        if (!isAvailable(s.id, dayIdx, includeBreakCover)) return false
        if (assignedPerDay[dayIdx].has(s.id)) return false
        if (roleFilter && s.job_role?.toLowerCase() !== roleFilter.toLowerCase()) return false
        if (skillFilter && !(s.skills ?? []).includes(skillFilter)) return false
        return true
      })
      .sort((a, b) => (hoursAssigned[a.id] ?? 0) - (hoursAssigned[b.id] ?? 0))
  }

  const assignShift = (staffMember, dayIdx, role, startTime = defaultStart, endTime = defaultEnd) => {
    const dateStr = format(days[dayIdx], 'yyyy-MM-dd')
    const hrs = shiftDurationHours(startTime, endTime)
    generated.push({
      staff_id: staffMember.id,
      shift_date: dateStr,
      week_start: weekStart,
      start_time: startTime,
      end_time: endTime,
      role_label: role || staffMember.job_role || 'Staff',
      _staffName: staffMember.name, // for preview display only
    })
    hoursAssigned[staffMember.id] += hrs
    assignedPerDay[dayIdx].add(staffMember.id)
  }

  // ── Pass 1: Role fulfillment ──────────────────────────────────────────
  for (let di = 0; di < days.length; di++) {
    if (closedDays.includes(di)) continue

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

      // Try staff with matching skills first, then any available staff
      const skillMatch = getAvailableStaff(di, { skillFilter: req.role.toLowerCase().replace(/\s+/g, '_') })
      const allCandidates = getAvailableStaff(di)
      // Deduplicate: skill matches first, then others
      const seen = new Set(skillMatch.map(s => s.id))
      const candidates = [...skillMatch, ...allCandidates.filter(s => !seen.has(s.id))]

      for (let i = 0; i < needed && i < candidates.length; i++) {
        assignShift(candidates[i], di, req.role)
      }

      if (candidates.length < needed) {
        warnings.push({
          type: 'role_unfilled',
          day: format(days[di], 'EEE d MMM'),
          role: req.role,
          message: `Could not fill ${needed - candidates.length} ${req.role} slot(s) on ${format(days[di], 'EEE d MMM')}: no available staff`,
        })
      }
    }
  }

  // ── Pass 1.5: Skill fulfillment ───────────────────────────────────────
  for (let di = 0; di < days.length; di++) {
    if (closedDays.includes(di)) continue

    for (const req of requiredSkills) {
      if (req.min <= 0) continue

      // Count already-assigned staff with this skill on this day
      let filled = 0
      if (mode === 'fill_gaps') {
        const dateStr = format(days[di], 'yyyy-MM-dd')
        filled = existingShifts.filter(sh => {
          if (sh.shift_date !== dateStr) return false
          const member = staff.find(s => s.id === sh.staff_id)
          return (member?.skills ?? []).includes(req.skill)
        }).length
      }
      // Also count already-generated shifts for today
      const dateStr = format(days[di], 'yyyy-MM-dd')
      filled += generated.filter(sh => {
        if (sh.shift_date !== dateStr) return false
        const member = staff.find(s => s.id === sh.staff_id)
        return (member?.skills ?? []).includes(req.skill)
      }).length

      const needed = req.min - filled
      if (needed <= 0) continue

      const candidates = getAvailableStaff(di, { skillFilter: req.skill })
      for (let i = 0; i < needed && i < candidates.length; i++) {
        assignShift(candidates[i], di, candidates[i].job_role || 'FOH')
      }

      if (candidates.length < needed) {
        const skillLabel = req.skill.charAt(0).toUpperCase() + req.skill.slice(1)
        warnings.push({
          type: 'skill_unfilled',
          day: format(days[di], 'EEE d MMM'),
          skill: req.skill,
          message: `Could not fill ${needed - candidates.length} ${skillLabel} slot(s) on ${format(days[di], 'EEE d MMM')}: no available staff with that skill`,
        })
      }
    }
  }

  // ── Pass 2: Minimum staffing ──────────────────────────────────────────
  for (let di = 0; di < days.length; di++) {
    if (closedDays.includes(di)) continue

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

  // ── Pass 3: Break cover ─────────────────────────────────────────────
  // Assign short lunchtime shifts (11:00-14:00) to staff marked as break_cover
  for (let di = 0; di < days.length; di++) {
    if (closedDays.includes(di)) continue

    const breakCoverStaff = staff.filter(s => {
      const dateStr = format(days[di], 'yyyy-MM-dd')
      const key = `${s.id}:${dateStr}`
      const entry = unavailability[key]
      return entry?.type === 'manual' && entry?.subtype === 'break_cover' && !assignedPerDay[di].has(s.id)
    })

    for (const s of breakCoverStaff) {
      assignShift(s, di, 'Break Cover', '11:00', '14:00')
    }
  }

  // ── Stats (use paid hours — deduct breaks per eligible shift) ──────────
  const totalHours = generated.reduce((sum, sh) => {
    const member = staff.find(s => s.id === sh.staff_id)
    return sum + paidShiftHours(sh.start_time, sh.end_time, member?.is_under_18 ?? false, breakDurationMins)
  }, 0)
  const estimatedCost = generated.reduce((sum, sh) => {
    const member = staff.find(s => s.id === sh.staff_id)
    const paid = paidShiftHours(sh.start_time, sh.end_time, member?.is_under_18 ?? false, breakDurationMins)
    return sum + paid * (member?.hourly_rate ?? 0)
  }, 0)

  const staffHoursBreakdown = staff
    .map(s => {
      const isU18 = s.is_under_18 ?? false
      return {
        staffId: s.id,
        name: s.name,
        existingHours: mode === 'fill_gaps'
          ? existingShifts
              .filter(sh => sh.staff_id === s.id)
              .reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, isU18, breakDurationMins), 0)
          : 0,
        newHours: generated
          .filter(sh => sh.staff_id === s.id)
          .reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, isU18, breakDurationMins), 0),
      }
    })
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
