import { addDays, format } from 'date-fns'
import { paidShiftHours, shiftCost, shiftDurationHours, type PayProfile } from './hours'

/** The least a shift needs for the rota to place and total it. */
export interface RotaShiftLike {
  id: string
  staff_id: string | null
  shift_date: string
  start_time: string
  end_time: string
}

/** The least a person needs: id plus what decides their pay. */
export interface RotaStaffLike extends PayProfile {
  id: string
  _crossVenue?: boolean
}

/** One entry of the availability map: approved time off, or a manual "unavailable". */
export interface RotaUnavailability {
  type: 'manual' | 'time_off'
  subtype?: string
  note?: string | null
}
export type RotaUnavailabilityMap = Record<string, RotaUnavailability>

/** A shift the person has at another venue (from get_staff_cross_venue_shifts). */
export interface RotaCrossShift {
  staff_id: string
  shift_date: string
  venue_name?: string
  [k: string]: unknown
}

export interface RotaDay {
  date: Date
  dateStr: string
  /** 0 = Monday … 6 = Sunday */
  index: number
  /** Closed by the weekly closed days or by a one-off closure. */
  closed: boolean
  /** Closed by a one-off closure (venue_closures) specifically. */
  closedByDate: boolean
}

/** Everything the rota knows about one person on one day. */
export interface RotaCell<S extends RotaShiftLike = RotaShiftLike> {
  shifts: S[]
  closed: boolean
  /** The raw availability entry, whatever its type. */
  unavail: RotaUnavailability | undefined
  isTimeOff: boolean
  isManualOff: boolean
  /** Their shift at another venue that day (only looked up for visiting staff). */
  crossShift: RotaCrossShift | null
}

export interface RotaDayTotals {
  /** Hours worked after unpaid breaks, unrounded. */
  paidHours: number
  rawHours: number
  cost: number
  /** Distinct people with at least one shift. */
  heads: number
  /** Shifts (a split shift counts twice). */
  shiftCount: number
}

export interface RotaPersonTotals {
  paidHours: number
  rawHours: number
  cost: number
  /** Shifts long enough to carry an unpaid break. */
  breakCount: number
  breakMins: number
  shiftCount: number
}

export interface BuildRotaWeekInput<S extends RotaShiftLike, P extends RotaStaffLike> {
  weekStart: Date
  shifts: S[]
  staff: P[]
  unavailability?: RotaUnavailabilityMap
  /** Weekly closed days, 0 = Monday. */
  closedDays?: number[]
  /** One-off closed dates, yyyy-MM-dd. */
  closedDates?: Set<string>
  crossShifts?: RotaCrossShift[]
  /** The venue's unpaid break for adult shifts over 6h. */
  breakDurationMins?: number
}

export interface RotaWeek<S extends RotaShiftLike, P extends RotaStaffLike> {
  days: RotaDay[]
  cell: (staffId: string, dateStr: string) => RotaCell<S>
  /** Totals per day of the week, closed days zeroed. */
  dayTotals: RotaDayTotals[]
  personTotals: (staffId: string) => RotaPersonTotals
  /** Wage bill for everyone on `staff`, closed-day shifts included. */
  weekCost: number
  staff: P[]
}

const EMPTY_TOTALS: RotaPersonTotals = { paidHours: 0, rawHours: 0, cost: 0, breakCount: 0, breakMins: 0, shiftCount: 0 }

/**
 * Turns the raw rota data (shifts, people, leave, closures, other-venue
 * shifts) into the one structure both rota screens draw from. Pure: no
 * React, no network. All the "which shifts are on which day, what counts as
 * closed, what does it cost" rules live here and nowhere else.
 */
export function buildRotaWeek<S extends RotaShiftLike, P extends RotaStaffLike>(
  input: BuildRotaWeekInput<S, P>,
): RotaWeek<S, P> {
  const {
    weekStart, shifts, staff,
    unavailability = {}, closedDays = [], crossShifts = [], breakDurationMins = 30,
  } = input
  const closedDates = input.closedDates ?? new Set<string>()

  const days: RotaDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const closedByDate = closedDates.has(dateStr)
    return { date, dateStr, index: i, closed: closedDays.includes(i) || closedByDate, closedByDate }
  })
  const dayByStr = new Map(days.map((d) => [d.dateStr, d]))

  // Shifts by "staffId:date", in the order given (a split day has two).
  const index = new Map<string, S[]>()
  for (const sh of shifts) {
    const key = `${sh.staff_id}:${sh.shift_date}`
    const list = index.get(key)
    if (list) list.push(sh)
    else index.set(key, [sh])
  }
  const NONE: S[] = []

  const staffById = new Map(staff.map((p) => [p.id, p]))
  const cell = (staffId: string, dateStr: string): RotaCell<S> => {
    const person = staffById.get(staffId)
    const unavail = unavailability[`${staffId}:${dateStr}`]
    return {
      shifts: index.get(`${staffId}:${dateStr}`) ?? NONE,
      closed: dayByStr.get(dateStr)?.closed ?? false,
      unavail,
      isTimeOff: unavail?.type === 'time_off',
      isManualOff: unavail?.type === 'manual',
      crossShift: person?._crossVenue
        ? crossShifts.find((cs) => cs.staff_id === staffId && cs.shift_date === dateStr) ?? null
        : null,
    }
  }

  // Per-person totals over the week's seven days. Closed-day shifts still count
  // here (the wage bill is what is on the rota); only the day columns zero them.
  const people = new Map<string, RotaPersonTotals>()
  for (const p of staff) {
    const under18 = p.is_under_18 ?? false
    let paidHours = 0, rawHours = 0, breakCount = 0, shiftCount = 0
    for (const d of days) {
      for (const sh of index.get(`${p.id}:${d.dateStr}`) ?? NONE) {
        const raw = shiftDurationHours(sh.start_time, sh.end_time)
        paidHours += paidShiftHours(sh.start_time, sh.end_time, under18, breakDurationMins)
        rawHours += raw
        if (under18 ? raw > 4.5 : raw > 6) breakCount++
        shiftCount++
      }
    }
    people.set(p.id, {
      paidHours, rawHours, breakCount, shiftCount,
      breakMins: breakCount * (under18 ? 30 : breakDurationMins),
      cost: paidHours * (p.hourly_rate ?? 0),
    })
  }

  const dayTotals: RotaDayTotals[] = days.map((d) => {
    const t: RotaDayTotals = { paidHours: 0, rawHours: 0, cost: 0, heads: 0, shiftCount: 0 }
    if (d.closed) return t
    for (const p of staff) {
      const list = index.get(`${p.id}:${d.dateStr}`)
      if (!list?.length) continue
      t.heads++
      for (const sh of list) {
        t.shiftCount++
        t.rawHours += shiftDurationHours(sh.start_time, sh.end_time)
        t.paidHours += paidShiftHours(sh.start_time, sh.end_time, p.is_under_18 ?? false, breakDurationMins)
        t.cost += shiftCost(sh.start_time, sh.end_time, p, breakDurationMins)
      }
    }
    return t
  })

  let weekCost = 0
  for (const p of staff) weekCost += people.get(p.id)?.cost ?? 0

  return {
    days, cell, dayTotals, staff, weekCost,
    personTotals: (staffId) => people.get(staffId) ?? EMPTY_TOTALS,
  }
}
