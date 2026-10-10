import { describe, it, expect } from 'vitest'
import {
  workedShifts, weekStarting, hoursByWeek, averageWeek,
  holidayAllowance, holidayUsed, estimateLeaveHours, zeroHoursHoliday, suggestedPaidHours,
  leaveHoursBreakdown,
} from '../holiday'

const ev = (event_type, occurred_at) => ({ event_type, occurred_at })
const NOW = new Date('2026-10-10T12:00:00Z')

// One shift of `hours` starting 10:00 UTC on `date`.
function shift(date, hours) {
  const start = new Date(`${date}T10:00:00Z`)
  return [
    ev('clock_in', start.toISOString()),
    ev('clock_out', new Date(start.getTime() + hours * 3_600_000).toISOString()),
  ]
}

describe('workedShifts', () => {
  it('subtracts breaks', () => {
    const { shifts } = workedShifts([
      ev('clock_in',    '2026-03-05T09:00:00Z'),
      ev('break_start', '2026-03-05T12:00:00Z'),
      ev('break_end',   '2026-03-05T12:30:00Z'),
      ev('clock_out',   '2026-03-05T17:00:00Z'),
    ], NOW)
    expect(shifts).toEqual([{ start: '2026-03-05T09:00:00Z', hours: 7.5 }])
  })

  it('flags a forgotten clock-out but keeps the stretch before the break', () => {
    const { shifts, missingClockOut } = workedShifts([
      ev('clock_in',    '2026-03-05T09:00:00Z'),
      ev('break_start', '2026-03-05T12:00:00Z'),
      ev('break_end',   '2026-03-05T12:30:00Z'),
      // no clock_out
      ...shift('2026-03-06', 6),
    ], NOW)
    expect(missingClockOut).toEqual(['2026-03-05T09:00:00Z'])
    expect(shifts.map(s => s.hours)).toEqual([3, 6])
  })

  it('ignores retried duplicate clock-ins (pre-106 rows)', () => {
    const { shifts, missingClockOut } = workedShifts([
      ev('clock_in',  '2026-03-05T09:00:00Z'),
      ev('clock_in',  '2026-03-05T09:00:40Z'),
      ev('clock_out', '2026-03-05T15:00:00Z'),
    ], NOW)
    expect(missingClockOut).toEqual([])
    expect(shifts).toEqual([{ start: '2026-03-05T09:00:00Z', hours: 6 }])
  })

  it('does not count or flag someone currently on shift', () => {
    const { shifts, missingClockOut } = workedShifts([ev('clock_in', '2026-10-10T09:00:00Z')], NOW)
    expect(shifts).toEqual([])
    expect(missingClockOut).toEqual([])
  })
})

describe('weeks', () => {
  it('weekStarting is the Monday', () => {
    expect(weekStarting('2026-10-10')).toBe('2026-10-05') // Sat → Mon
    expect(weekStarting('2026-10-05')).toBe('2026-10-05')
    expect(weekStarting('2026-10-11')).toBe('2026-10-05') // Sun stays in the same week
  })

  it('averageWeek skips empty weeks, uses the last 12 worked, ignores the current week', () => {
    const weeks = new Map()
    // 14 worked weeks, alternating with empty ones; the two oldest are 100h and must be ignored
    for (let i = 1; i <= 14; i++) {
      const d = new Date(Date.UTC(2026, 9, 5 - 14 * i)).toISOString().slice(0, 10)
      weeks.set(weekStarting(d), i > 12 ? 100 : 10)
    }
    weeks.set('2026-10-05', 50) // this week, unfinished
    expect(averageWeek(weeks, '2026-10-10')).toEqual({ avgWeekHours: 10, weeksUsed: 12 })
  })
})

describe('holidayAllowance', () => {
  // Sarah-like: 13.7h average week over her recent worked weeks
  const shifts = []
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(2026, 9, 9 - 7 * i)).toISOString().slice(0, 10) // Fridays
    shifts.push({ start: `${d}T10:00:00Z`, hours: 13.7 })
  }

  it('NI: someone here before this year has the whole year from January (so they can book ahead)', () => {
    const a = holidayAllowance({ region: 'ni', shifts, year: 2026, today: '2026-10-10', startDate: '2024-03-01' })
    expect(a.allowance).toBe(76.7)                  // 5.6 × 13.7
    expect(a.yearAllowance).toBe(76.7)
    expect(a.avgWeekHours).toBe(13.7)
  })

  it('GB: 12.07% of hours worked this year', () => {
    const a = holidayAllowance({ region: 'gb', shifts, year: 2026, today: '2026-10-10' })
    expect(a.hoursThisYear).toBe(164.4)
    expect(a.allowance).toBe(19.8)
  })

  it('NI first year: the year share, built up a twelfth a month', () => {
    // Joined 15 Sep: one month started by 10 Oct (the second starts 15 Oct) → 1/12
    const a = holidayAllowance({ region: 'ni', shifts, year: 2026, today: '2026-10-10', startDate: '2026-09-15' })
    expect(a.firstYear).toBe(true)
    expect(a.allowance).toBe(6.4)
    // By December the year share (Sep–Dec = 4/12) caps it
    const dec = holidayAllowance({ region: 'ni', shifts, year: 2026, today: '2026-12-31', startDate: '2026-09-15' })
    expect(dec.allowance).toBe(Math.round(5.6 * dec.avgWeekHours * (4 / 12) * 10) / 10)
  })
})

describe('start date', () => {
  // Joined 25 Sep, two weeks of about 9.3 h
  const events = [
    ...shift('2026-09-25', 9.3), ...shift('2026-10-02', 9.3),
  ]
  const base = { region: 'ni', events, requests: [], year: 2026, today: '2026-10-10', now: NOW }

  it('uses the first clock-in when no start date is saved, so a new starter gets a month, not a year', () => {
    const h = zeroHoursHoliday({ ...base, staff: { working_days: [] } })
    expect(h.startDateGuessed).toBe(true)
    expect(h.firstYear).toBe(true)
    expect(h.allowance).toBe(4.3)                   // 5.6 × 9.3 × 1/12
  })

  it('a saved start date wins over the first clock-in', () => {
    const h = zeroHoursHoliday({ ...base, staff: { working_days: [], start_date: '2024-03-01' } })
    expect(h.startDateGuessed).toBe(false)
    expect(h.firstYear).toBe(false)
    expect(h.allowance).toBe(52.1)                  // 5.6 × 9.3, the whole year
  })
})

describe('holidayUsed', () => {
  const base = { status: 'approved', leave_type: 'annual' }

  it('uses recorded paid hours', () => {
    const r = holidayUsed([{ ...base, start_date: '2026-07-01', end_date: '2026-07-07', paid_hours: 20 }],
      { year: 2026, avgWeekHours: 30, workingDays: [] })
    expect(r).toEqual({ used: 20, estimated: false })
  })

  it('ignores unavailable, unpaid, pending and cancelled', () => {
    const r = holidayUsed([
      { ...base, leave_type: 'unavailable', start_date: '2026-07-01', end_date: '2026-07-07' },
      { ...base, leave_type: 'unpaid',      start_date: '2026-07-01', end_date: '2026-07-07' },
      { ...base, status: 'pending',         start_date: '2026-07-01', end_date: '2026-07-07' },
      { ...base, status: 'cancelled',       start_date: '2026-07-01', end_date: '2026-07-07' },
    ], { year: 2026, avgWeekHours: 30, workingDays: [] })
    expect(r).toEqual({ used: 0, estimated: false })
  })

  it('ignores other years and clips requests crossing new year', () => {
    const r = holidayUsed([
      { ...base, start_date: '2025-06-01', end_date: '2025-06-07' },
      { ...base, start_date: '2025-12-29', end_date: '2026-01-04', paid_hours: 14 }, // 4 of 7 days in 2026
    ], { year: 2026, avgWeekHours: 30, workingDays: [] })
    expect(r.used).toBe(8)
  })

  it('estimates a week off as one average week, and says it is an estimate', () => {
    // Thu–Sun worker, Mon–Sun off: only the 4 pattern days count, each a quarter of the week
    const r = holidayUsed([{ ...base, start_date: '2026-04-13', end_date: '2026-04-19' }],
      { year: 2026, avgWeekHours: 13.7, workingDays: [4, 5, 6, 7] })
    expect(r).toEqual({ used: 13.7, estimated: true })
  })

  it('a booked Monday outside a Thu–Sun pattern costs nothing', () => {
    expect(estimateLeaveHours('2026-04-13', '2026-04-13', 13.7, [4, 5, 6, 7])).toBe(0)
  })
})

describe('zeroHoursHoliday', () => {
  const events = []
  for (let i = 1; i <= 12; i++) {
    events.push(...shift(new Date(Date.UTC(2026, 9, 9 - 7 * i)).toISOString().slice(0, 10), 10))
  }
  const staff = { working_days: [], holiday_pay_eligible: true }

  it('needs the venue region before it shows anything', () => {
    expect(zeroHoursHoliday({ region: null, staff, events, requests: [], year: 2026, today: '2026-10-10', now: NOW }))
      .toEqual({ status: 'needs_region' })
  })

  it('self-employed people have no statutory holiday', () => {
    expect(zeroHoursHoliday({ region: 'ni', staff: { holiday_pay_eligible: false }, events, requests: [], year: 2026, today: '2026-10-10', now: NOW }))
      .toEqual({ status: 'self_employed' })
  })

  it('shows a negative balance when more was taken than earned', () => {
    const h = zeroHoursHoliday({
      region: 'gb', staff, events, year: 2026, today: '2026-10-10', now: NOW,
      requests: [{ status: 'approved', leave_type: 'annual', start_date: '2026-08-01', end_date: '2026-08-02', paid_hours: 20 }],
    })
    expect(h.allowance).toBe(14.5) // 120h × 12.07%
    expect(h.balance).toBe(-5.5)
  })

  it('holiday already paid outside a booking comes off the balance', () => {
    const h = zeroHoursHoliday({
      region: 'gb', staff, events, year: 2026, today: '2026-10-10', now: NOW,
      requests: [{ status: 'approved', leave_type: 'annual', start_date: '2026-08-01', end_date: '2026-08-02', paid_hours: 4 }],
      paidOut: [{ hours: 6 }, { hours: '2.5' }],
    })
    expect(h.paidOutHours).toBe(8.5)
    expect(h.used).toBe(12.5)   // 4 booked + 8.5 paid out
    expect(h.balance).toBe(2)   // 14.5 − 12.5
  })

  it('suggestedPaidHours prefills from the average week', () => {
    expect(suggestedPaidHours({ start_date: '2026-11-02', end_date: '2026-11-08' }, 10, [])).toBe(10)
    expect(suggestedPaidHours({ start_date: '2026-11-02', end_date: '2026-11-08' }, null, [])).toBe(null)
  })
})

describe('hoursByWeek', () => {
  it('buckets by London date, so a 00:30 BST start stays on its own day', () => {
    // 23:30 UTC Sunday 4 Oct = 00:30 BST Monday 5 Oct → week of 5 Oct
    const weeks = hoursByWeek([{ start: '2026-10-04T23:30:00Z', hours: 5 }])
    expect([...weeks.keys()]).toEqual(['2026-10-05'])
  })
})

describe('leaveHoursBreakdown', () => {
  const thuSun = [4, 5, 6, 7]

  it('a Saturday off is a quarter of a Thu–Sun average week', () => {
    expect(suggestedPaidHours({ start_date: '2026-11-14', end_date: '2026-11-14' }, 13.7, thuSun)).toBe(3.4)
  })

  it('uses the rota shift where they were already scheduled', () => {
    const b = leaveHoursBreakdown(
      { start_date: '2026-11-14', end_date: '2026-11-15' }, // Sat + Sun
      13.7, thuSun, { '2026-11-14': 8 },
    )
    expect(b).toEqual({ hours: 11.4, rotaHours: 8, rotaDays: 1, averageHours: 3.4, averageDays: 1 })
  })

  it('a day outside their usual days costs nothing, unless they were rota\'d on it', () => {
    expect(suggestedPaidHours({ start_date: '2026-11-09', end_date: '2026-11-09' }, 13.7, thuSun)).toBe(0) // Mon
    expect(suggestedPaidHours({ start_date: '2026-11-09', end_date: '2026-11-09' }, 13.7, thuSun, { '2026-11-09': 6 })).toBe(6)
  })

  it('works from the rota alone for someone with no average yet', () => {
    expect(suggestedPaidHours({ start_date: '2026-11-14', end_date: '2026-11-14' }, null, [], { '2026-11-14': 7.5 })).toBe(7.5)
    expect(suggestedPaidHours({ start_date: '2026-11-14', end_date: '2026-11-14' }, null, [])).toBe(null)
  })
})
