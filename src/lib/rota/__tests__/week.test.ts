import { describe, it, expect } from 'vitest'
import { buildRotaWeek } from '..'

// Monday 5 Oct 2026 (local midnight)
const MON = new Date(2026, 9, 5)
const D = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']

const ana = { id: 'ana', hourly_rate: 12, is_under_18: false }
const ben = { id: 'ben', hourly_rate: 10, is_under_18: true }
const cat = { id: 'cat', hourly_rate: 15, is_under_18: false, _crossVenue: true }

let n = 0
const sh = (who: { id: string }, day: number, start: string, end: string) =>
  ({ id: `s${++n}`, staff_id: who.id, shift_date: D[day], start_time: start, end_time: end })

const SHIFTS = [
  sh(ana, 0, '09:00', '17:00'),   // 8h
  sh(ana, 1, '18:00', '02:00'),   // overnight, belongs to Tuesday
  sh(ana, 2, '09:00', '13:00'),   // split day…
  sh(ana, 2, '17:00', '22:00'),   // …two shifts
  sh(ben, 0, '10:00', '15:00'),   // under 18, 5h
  sh(ben, 4, '09:00', '12:00'),   // on the closed Friday
]

const build = (over = {}) => buildRotaWeek({
  weekStart: MON, shifts: SHIFTS, staff: [ana, ben, cat], breakDurationMins: 45, ...over,
})

describe('buildRotaWeek', () => {
  it('lays out Monday to Sunday', () => {
    const w = build()
    expect(w.days.map((d) => d.dateStr)).toEqual(D)
    expect(w.days.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('keeps every shift of a split day, in order, and an overnight shift on its start day', () => {
    const w = build()
    expect(w.cell('ana', D[2]).shifts.map((s) => s.start_time)).toEqual(['09:00', '17:00'])
    expect(w.cell('ana', D[1]).shifts).toHaveLength(1)
    expect(w.cell('ana', D[2]).shifts).toHaveLength(2)
    expect(w.cell('ana', D[3]).shifts).toEqual([])
  })

  it('marks weekly closed days and one-off closures, and tells them apart', () => {
    const w = build({ closedDays: [6], closedDates: new Set([D[4]]) })
    expect(w.days.map((d) => d.closed)).toEqual([false, false, false, false, true, false, true])
    expect(w.days[4].closedByDate).toBe(true)
    expect(w.days[6].closedByDate).toBe(false)
    expect(w.cell('ben', D[4]).closed).toBe(true)
  })

  it('exposes leave, manual unavailability and other-venue shifts per cell', () => {
    const w = build({
      unavailability: {
        [`ana:${D[3]}`]: { type: 'time_off' },
        [`ben:${D[1]}`]: { type: 'manual', subtype: 'unavailable' },
      },
      crossShifts: [
        { staff_id: 'cat', shift_date: D[5], venue_name: 'Other Place' },
        { staff_id: 'ana', shift_date: D[5], venue_name: 'Ignored: not a visiting person' },
      ],
    })
    expect(w.cell('ana', D[3]).isTimeOff).toBe(true)
    expect(w.cell('ana', D[3]).isManualOff).toBe(false)
    expect(w.cell('ben', D[1]).isManualOff).toBe(true)
    expect(w.cell('cat', D[5]).crossShift?.venue_name).toBe('Other Place')
    expect(w.cell('ana', D[5]).crossShift).toBeNull()
  })

  it('totals each person with the venue break and the under-18 rule', () => {
    const w = build()
    const a = w.personTotals('ana')
    expect(a.rawHours).toBe(25)
    expect(a.paidHours).toBe(23.5)          // 7.25 + 7.25 + 4 + 5
    expect(a.cost).toBe(23.5 * 12)
    expect(a.breakCount).toBe(2)
    expect(a.breakMins).toBe(90)
    expect(a.shiftCount).toBe(4)
    const b = w.personTotals('ben')
    expect(b.paidHours).toBe(7.5)           // 4.5 (30m statutory) + 3
    expect(b.breakMins).toBe(30)
    expect(w.personTotals('nobody').cost).toBe(0)
  })

  it('totals each day by people and by shifts, zeroing closed days', () => {
    const w = build({ closedDates: new Set([D[4]]) })
    expect(w.dayTotals[0].heads).toBe(2)
    expect(w.dayTotals[2].heads).toBe(1)        // one person…
    expect(w.dayTotals[2].shiftCount).toBe(2)   // …two shifts
    expect(w.dayTotals[2].paidHours).toBe(9)
    expect(w.dayTotals[4]).toEqual({ paidHours: 0, rawHours: 0, cost: 0, heads: 0, shiftCount: 0 })
  })

  it('keeps closed-day shifts in the wage bill (it is what is on the rota)', () => {
    const w = build({ closedDates: new Set([D[4]]) })
    expect(w.weekCost).toBe(23.5 * 12 + 7.5 * 10)
  })

  it('copes with an empty week', () => {
    const w = buildRotaWeek({ weekStart: MON, shifts: [], staff: [] })
    expect(w.weekCost).toBe(0)
    expect(w.dayTotals.every((t) => t.heads === 0)).toBe(true)
  })
})
