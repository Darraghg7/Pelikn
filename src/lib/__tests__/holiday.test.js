import { describe, it, expect } from 'vitest'
import {
  workedShifts, weekStarting, hoursByWeek, averageWeek,
  holidayAllowance, holidayUsed, estimateLeaveHours, zeroHoursHoliday, suggestedPaidHours,
  leaveHoursBreakdown, startDateBelievable,
} from '../holiday'
import { holidayYearStarting, holidayYearContaining, previousHolidayYear } from '../holidayYear'

const ev = (event_type, occurred_at) => ({ event_type, occurred_at })
const NOW = new Date('2026-10-10T12:00:00Z')
const CAL_2026 = holidayYearStarting(2026, 1)
const APR_2026 = holidayYearStarting(2026, 4)   // 1 Apr 2026 – 31 Mar 2027

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
    const a = holidayAllowance({ region: 'ni', shifts, holidayYear: CAL_2026, today: '2026-10-10', startDate: '2024-03-01' })
    expect(a.allowance).toBe(76.7)                  // 5.6 × 13.7
    expect(a.yearAllowance).toBe(76.7)
    expect(a.avgWeekHours).toBe(13.7)
  })

  it('GB: 12.07% of hours worked this year', () => {
    const a = holidayAllowance({ region: 'gb', shifts, holidayYear: CAL_2026, today: '2026-10-10' })
    expect(a.hoursThisYear).toBe(164.4)
    expect(a.allowance).toBe(19.8)
  })

  it('NI first year: the year share, built up a twelfth a month', () => {
    // Joined 15 Sep: one month started by 10 Oct (the second starts 15 Oct) → 1/12
    const a = holidayAllowance({ region: 'ni', shifts, holidayYear: CAL_2026, today: '2026-10-10', startDate: '2026-09-15' })
    expect(a.firstYear).toBe(true)
    expect(a.allowance).toBe(6.4)
    // By December the year share (Sep–Dec = 4/12) caps it
    const dec = holidayAllowance({ region: 'ni', shifts, holidayYear: CAL_2026, today: '2026-12-31', startDate: '2026-09-15' })
    expect(dec.allowance).toBe(Math.round(5.6 * dec.avgWeekHours * (4 / 12) * 10) / 10)
  })
})

describe('start date', () => {
  // Joined 25 Sep, two weeks of about 9.3 h
  const events = [
    ...shift('2026-09-25', 9.3), ...shift('2026-10-02', 9.3),
  ]
  const base = { region: 'ni', events, requests: [], holidayYear: CAL_2026, today: '2026-10-10', now: NOW }

  it('uses the first clock-in when no start date is saved and it is clearly after the venue started, so a new starter gets a month, not a year', () => {
    const h = zeroHoursHoliday({ ...base, staff: { working_days: [] }, firstClockIn: '2026-09-25', venueFirstClockIn: '2025-02-01' })
    expect(h.startDateGuessed).toBe(true)
    expect(h.startDateMissing).toBe(true)
    expect(h.guessedStartDate).toBe('2026-09-25')
    expect(h.firstYear).toBe(true)
    expect(h.allowance).toBe(4.3)                   // 5.6 × 9.3 × 1/12
  })

  it('without the venue\'s first clock-in there is nothing to judge a guess by: full year, start date asked for', () => {
    const h = zeroHoursHoliday({ ...base, staff: { working_days: [] }, firstClockIn: '2026-09-25' })
    expect(h.startDateGuessed).toBe(false)
    expect(h.startDateMissing).toBe(true)
    expect(h.firstYear).toBe(false)
    expect(h.allowance).toBe(52.1)
  })

  it('a saved start date wins over the first clock-in', () => {
    const h = zeroHoursHoliday({ ...base, staff: { working_days: [], start_date: '2024-03-01' } })
    expect(h.startDateGuessed).toBe(false)
    expect(h.startDateMissing).toBe(false)
    expect(h.firstYear).toBe(false)
    expect(h.allowance).toBe(52.1)                  // 5.6 × 9.3, the whole year
  })
})

describe('start date: venue new to Pelikn', () => {
  // Nomad-style: the venue's first clock-in on Pelikn was 6 Mar 2026. Sarah
  // has worked Fri–Sun for years, has no start date saved, and her first
  // clock-in on record is that first weekend.
  const weekends = []
  for (let t = Date.parse('2026-03-06T00:00:00Z'); t < Date.parse('2026-10-10T00:00:00Z'); t += 7 * 86_400_000) {
    const fri = new Date(t).toISOString().slice(0, 10)
    weekends.push(...shift(fri, 6))
  }
  const base = {
    region: 'ni', events: weekends, holidayYear: CAL_2026, today: '2026-10-10', now: NOW,
    venueFirstClockIn: '2026-03-06',
  }
  // A week's holiday booked Fri–Sun, three times
  const leave = ['2026-05-01', '2026-07-03', '2026-08-14'].map((d, i) => ({
    id: `r${i}`, status: 'approved', leave_type: 'annual', start_date: d,
    end_date: new Date(Date.parse(`${d}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10),
  }))

  it('someone clocking in from the venue\'s first weeks gets the full year, not a 2026 starter\'s share', () => {
    const h = zeroHoursHoliday({ ...base, requests: leave, staff: { working_days: [5, 6, 7] }, firstClockIn: '2026-03-06' })
    expect(h.firstYear).toBe(false)
    expect(h.startDateGuessed).toBe(false)
    expect(h.startDateMissing).toBe(true)
    expect(h.allowance).toBe(round1(5.6 * h.avgWeekHours))
    expect(h.balance).toBeGreaterThan(0)
  })

  it('a first clock-in a few weeks after the venue started still counts as already working there', () => {
    const h = zeroHoursHoliday({ ...base, requests: [], staff: { working_days: [] }, firstClockIn: '2026-04-10' })
    expect(h.firstYear).toBe(false)
    expect(h.startDateGuessed).toBe(false)
  })

  it('a first clock-in well after the venue started is taken as a new starter', () => {
    const h = zeroHoursHoliday({ ...base, requests: [], staff: { working_days: [] }, firstClockIn: '2026-09-25' })
    expect(h.firstYear).toBe(true)
    expect(h.startDateGuessed).toBe(true)
    expect(h.guessedStartDate).toBe('2026-09-25')
  })

  it('the cut-off is six weeks after the venue\'s first clock-in', () => {
    expect(startDateBelievable('2026-04-17', '2026-03-06')).toBe(false)   // 42 days on
    expect(startDateBelievable('2026-04-18', '2026-03-06')).toBe(true)    // 43 days on
    expect(startDateBelievable(null, '2026-03-06')).toBe(false)
    expect(startDateBelievable('2026-09-25', null)).toBe(false)
  })

  it('GB never asks for a start date: holiday comes from hours worked', () => {
    const h = zeroHoursHoliday({ ...base, region: 'gb', requests: [], staff: { working_days: [] }, firstClockIn: '2026-09-25' })
    expect(h.startDateMissing).toBe(false)
    expect(h.startDateGuessed).toBe(false)
  })
})

const round1 = (n) => Math.round(n * 10) / 10

describe('holidayUsed', () => {
  const base = { status: 'approved', leave_type: 'annual' }

  it('uses recorded paid hours', () => {
    const r = holidayUsed([{ ...base, start_date: '2026-07-01', end_date: '2026-07-07', paid_hours: 20 }],
      { holidayYear: CAL_2026, avgWeekHours: 30, workingDays: [] })
    expect(r).toEqual({ used: 20, estimated: false })
  })

  it('ignores unavailable, unpaid, pending and cancelled', () => {
    const r = holidayUsed([
      { ...base, leave_type: 'unavailable', start_date: '2026-07-01', end_date: '2026-07-07' },
      { ...base, leave_type: 'unpaid',      start_date: '2026-07-01', end_date: '2026-07-07' },
      { ...base, status: 'pending',         start_date: '2026-07-01', end_date: '2026-07-07' },
      { ...base, status: 'cancelled',       start_date: '2026-07-01', end_date: '2026-07-07' },
    ], { holidayYear: CAL_2026, avgWeekHours: 30, workingDays: [] })
    expect(r).toEqual({ used: 0, estimated: false })
  })

  it('ignores other years and clips requests crossing new year', () => {
    const r = holidayUsed([
      { ...base, start_date: '2025-06-01', end_date: '2025-06-07' },
      { ...base, start_date: '2025-12-29', end_date: '2026-01-04', paid_hours: 14 }, // 4 of 7 days in 2026
    ], { holidayYear: CAL_2026, avgWeekHours: 30, workingDays: [] })
    expect(r.used).toBe(8)
  })

  it('estimates a week off as one average week, and says it is an estimate', () => {
    // Thu–Sun worker, Mon–Sun off: only the 4 pattern days count, each a quarter of the week
    const r = holidayUsed([{ ...base, start_date: '2026-04-13', end_date: '2026-04-19' }],
      { holidayYear: CAL_2026, avgWeekHours: 13.7, workingDays: [4, 5, 6, 7] })
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
    expect(zeroHoursHoliday({ region: null, staff, events, requests: [], holidayYear: CAL_2026, today: '2026-10-10', now: NOW }))
      .toEqual({ status: 'needs_region' })
  })

  it('self-employed people have no statutory holiday', () => {
    expect(zeroHoursHoliday({ region: 'ni', staff: { holiday_pay_eligible: false }, events, requests: [], holidayYear: CAL_2026, today: '2026-10-10', now: NOW }))
      .toEqual({ status: 'self_employed' })
  })

  it('shows a negative balance when more was taken than earned', () => {
    const h = zeroHoursHoliday({
      region: 'gb', staff, events, holidayYear: CAL_2026, today: '2026-10-10', now: NOW,
      requests: [{ status: 'approved', leave_type: 'annual', start_date: '2026-08-01', end_date: '2026-08-02', paid_hours: 20 }],
    })
    expect(h.allowance).toBe(14.5) // 120h × 12.07%
    expect(h.balance).toBe(-5.5)
  })

  it('holiday already paid outside a booking comes off the balance', () => {
    const h = zeroHoursHoliday({
      region: 'gb', staff, events, holidayYear: CAL_2026, today: '2026-10-10', now: NOW,
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

describe('holiday year', () => {
  it('January is the calendar year, labelled by its year', () => {
    expect(holidayYearContaining('2026-10-10', 1)).toEqual({ startYear: 2026, start: '2026-01-01', end: '2026-12-31', startMonth: 1, label: '2026' })
  })

  it('April–March: named by the year it starts in, labelled with both ends', () => {
    expect(holidayYearContaining('2026-10-10', 4)).toEqual({ startYear: 2026, start: '2026-04-01', end: '2027-03-31', startMonth: 4, label: 'Apr 2026 – Mar 2027' })
    // 10 Feb 2027 is still in the 2026 holiday year; 1 Apr 2027 starts the next
    expect(holidayYearContaining('2027-02-10', 4).startYear).toBe(2026)
    expect(holidayYearContaining('2027-04-01', 4).startYear).toBe(2027)
    expect(holidayYearContaining('2026-03-31', 4).label).toBe('Apr 2025 – Mar 2026')
  })

  it('handles a February end in a leap year, and steps back a year', () => {
    expect(holidayYearStarting(2027, 3).end).toBe('2028-02-29')
    expect(previousHolidayYear(APR_2026)).toEqual(holidayYearStarting(2025, 4))
  })

  it('an unset or broken month falls back to January', () => {
    expect(holidayYearContaining('2026-10-10', undefined).start).toBe('2026-01-01')
    expect(holidayYearContaining('2026-10-10', 13).start).toBe('2026-01-01')
  })
})

describe('April–March holiday year', () => {
  // 10 h every Friday from 2 Jan 2026 to 9 Oct 2026
  const shifts = []
  for (let t = Date.UTC(2026, 0, 2); t <= Date.UTC(2026, 9, 9); t += 7 * 86_400_000) {
    shifts.push({ start: `${new Date(t).toISOString().slice(0, 10)}T10:00:00Z`, hours: 10 })
  }

  it('GB counts hours from 1 April, not 1 January', () => {
    const a = holidayAllowance({ region: 'gb', shifts, holidayYear: APR_2026, today: '2026-10-10' })
    // Fridays 3 Apr … 9 Oct = 28 shifts
    expect(a.hoursThisYear).toBe(280)
    expect(a.allowance).toBe(33.8)                  // 280 × 12.07%
  })

  it('NI first year: a September starter gets Sep–Mar, 7/12, by the end of the year', () => {
    const at = (today) => holidayAllowance({ region: 'ni', shifts, holidayYear: APR_2026, today, startDate: '2026-09-15' })
    expect(at('2026-10-10').firstYear).toBe(true)
    expect(at('2026-10-10').allowance).toBe(4.7)    // 5.6 × 10 × 1/12
    expect(at('2027-03-31').yearAllowance).toBe(32.7) // 5.6 × 10 × 7/12
  })

  it('NI: someone who joined in February (last holiday year) has the whole year', () => {
    const a = holidayAllowance({ region: 'ni', shifts, holidayYear: APR_2026, today: '2026-10-10', startDate: '2026-02-01' })
    expect(a.firstYear).toBe(false)
    expect(a.allowance).toBe(56)
  })

  it('splits a request crossing 31 March by days', () => {
    const r = holidayUsed([
      { status: 'approved', leave_type: 'annual', start_date: '2026-03-30', end_date: '2026-04-02', paid_hours: 16 }, // 2 of 4 days in
      { status: 'approved', leave_type: 'annual', start_date: '2026-02-01', end_date: '2026-02-03', paid_hours: 9 },  // last year
      { status: 'approved', leave_type: 'annual', start_date: '2027-03-01', end_date: '2027-03-01', paid_hours: 5 },  // still this year
    ], { holidayYear: APR_2026, avgWeekHours: 10, workingDays: [] })
    expect(r.used).toBe(13)
  })

  it('missing clock-outs are counted for this holiday year only', () => {
    const events = [
      ev('clock_in', '2026-03-20T10:00:00Z'),            // never closed, last holiday year
      ev('clock_in', '2026-05-01T10:00:00Z'),            // never closed, this year
      ...shift('2026-05-08', 6),
    ]
    const h = zeroHoursHoliday({ region: 'gb', staff: {}, events, requests: [], holidayYear: APR_2026, today: '2026-10-10', now: NOW })
    expect(h.missingClockOuts).toBe(1)
  })
})

describe('carry-over', () => {
  const events = []
  for (let i = 1; i <= 12; i++) {
    events.push(...shift(new Date(Date.UTC(2026, 9, 9 - 7 * i)).toISOString().slice(0, 10), 10))
  }
  const base = { region: 'gb', staff: {}, events, requests: [], holidayYear: CAL_2026, today: '2026-10-10', now: NOW }

  it('adds to the balance, not to what was built up or used', () => {
    const h = zeroHoursHoliday({ ...base, carriedOver: [{ hours: '7.5' }], paidOut: [{ hours: 2 }] })
    expect(h.allowance).toBe(14.5)
    expect(h.carriedOverHours).toBe(7.5)
    expect(h.used).toBe(2)
    expect(h.balance).toBe(20)    // 14.5 + 7.5 − 2
  })

  it('no carry-over leaves the balance alone', () => {
    const h = zeroHoursHoliday(base)
    expect(h.carriedOverHours).toBe(0)
    expect(h.balance).toBe(14.5)
  })
})

describe('days-based staff in an April–March year', () => {
  it('counts working days inside the holiday year only, splitting a request across 1 April', async () => {
    const { daysUsedInHolidayYear } = await import('../../hooks/useLeaveBalance')
    const monFri = [1, 2, 3, 4, 5]
    const used = daysUsedInHolidayYear([
      { start_date: '2026-03-30', end_date: '2026-04-03' },                       // Mon–Fri: Wed–Fri inside = 3
      { start_date: '2026-03-02', end_date: '2026-03-06' },                       // last holiday year
      { start_date: '2027-03-29', end_date: '2027-04-02', status: 'approved' },   // Mon–Wed inside = 3
      { start_date: '2026-06-01', end_date: '2026-06-05', status: 'pending' },    // not approved
    ], APR_2026, monFri)
    expect(used).toBe(6)
  })
})
