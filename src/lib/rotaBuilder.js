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
