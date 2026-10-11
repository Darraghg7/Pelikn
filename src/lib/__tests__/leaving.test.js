import { describe, it, expect } from 'vitest'
import { leaveYearShare, leaveUpTo, leaverHolidayHours, leaverHolidayDays, leaverHolidayPay } from '../leaving'
import { holidayYearContaining } from '../holidayYear'

const ev = (event_type, occurred_at) => ({ event_type, occurred_at })
const NOW = new Date('2026-10-10T12:00:00Z')

function shift(date, hours) {
  const start = new Date(`${date}T09:00:00Z`)
  return [
    ev('clock_in', start.toISOString()),
    ev('clock_out', new Date(start.getTime() + hours * 3_600_000).toISOString()),
  ]
}

// 10 hours every Monday and Tuesday for the 12 weeks from 6 April 2026: a 20-hour average week.
function twelveWeeks() {
  const out = []
  for (let w = 0; w < 12; w++) {
    const mon = new Date(Date.UTC(2026, 3, 6 + 7 * w)).toISOString().slice(0, 10)
    const tue = new Date(Date.UTC(2026, 3, 7 + 7 * w)).toISOString().slice(0, 10)
    out.push(...shift(mon, 10), ...shift(tue, 10))
  }
  return out
}

const leave = (start_date, end_date, extra = {}) => ({ start_date, end_date, status: 'approved', leave_type: 'annual', ...extra })

describe('leaveYearShare', () => {
  it('runs from 1 January to the last day', () => {
    expect(leaveYearShare('2026-06-30')).toBeCloseTo(181 / 365)
    expect(leaveYearShare('2026-12-31')).toBe(1)
  })

  it('starts from their start date if they joined this year', () => {
    expect(leaveYearShare('2026-09-30', '2026-04-01')).toBeCloseTo(183 / 365)
    expect(leaveYearShare('2026-09-30', '2019-04-01')).toBeCloseTo(273 / 365)
  })

  it('follows the venue\'s holiday year: an April year leaver on 30 June has worked 91 of 365 days', () => {
    const hy = holidayYearContaining('2026-06-30', 4)
    expect(leaveYearShare('2026-06-30', null, hy)).toBeCloseTo(91 / 365)
  })

  it('is nothing if they leave before they start', () => {
    expect(leaveYearShare('2026-03-01', '2026-04-01')).toBe(0)
  })
})

describe('leaveUpTo', () => {
  it('drops leave after the last day and cuts leave that runs past it', () => {
    const out = leaveUpTo([
      leave('2026-05-04', '2026-05-05', { paid_hours: 16 }),
      leave('2026-06-29', '2026-07-02', { paid_hours: 32 }),
      leave('2026-08-10', '2026-08-14', { paid_hours: 40 }),
    ], '2026-06-30')
    expect(out).toHaveLength(2)
    expect(out[1]).toMatchObject({ end_date: '2026-06-30', paid_hours: 16 })
  })
})

describe('leaverHolidayDays', () => {
  const base = { entitlementDays: 28, workingDays: [1, 2, 3, 4, 5], lastDay: '2026-06-30' }

  it('pro-rates the year and takes off leave used up to the last day', () => {
    const r = leaverHolidayDays({
      ...base,
      requests: [
        leave('2026-03-02', '2026-03-06'),  // Mon–Fri: 5
        leave('2026-06-29', '2026-07-03'),  // only Mon 29 and Tue 30 count: 2
        leave('2026-08-10', '2026-08-14'),  // after they've gone: 0
      ],
    })
    expect(r).toMatchObject({ status: 'ok', unit: 'days', earned: 13.9, used: 7, owed: 6.9 })
  })

  it('adds holiday carried over into the year', () => {
    const r = leaverHolidayDays({ ...base, requests: [], carriedOver: [{ days: 2 }] })
    expect(r).toMatchObject({ earned: 13.9, carriedOver: 2, owed: 15.9 })
  })

  it('April holiday year: only counts leave since 1 April', () => {
    const r = leaverHolidayDays({
      ...base,
      holidayYear: holidayYearContaining('2026-06-30', 4),
      requests: [leave('2026-03-02', '2026-03-06'), leave('2026-04-06', '2026-04-10')],  // March is last year
    })
    expect(r).toMatchObject({ earned: 7, used: 5, owed: 2 })  // 28 × 91/365 = 6.98
  })

  it('first-year leavers earn from their start date', () => {
    const r = leaverHolidayDays({ ...base, startDate: '2026-04-01', lastDay: '2026-09-30', requests: [] })
    expect(r.earned).toBe(14)
  })

  it('counts holiday already paid in days', () => {
    const r = leaverHolidayDays({ ...base, requests: [], paidOut: [{ days: 3 }] })
    expect(r.used).toBe(3)
    expect(r.owed).toBe(10.9)
  })

  it('goes negative when more was taken than earned', () => {
    const r = leaverHolidayDays({ ...base, requests: [leave('2026-01-05', '2026-01-30')] })  // 20 weekdays
    expect(r.owed).toBe(-6.1)
  })

  it('ignores leave that is not approved annual leave', () => {
    const r = leaverHolidayDays({
      ...base,
      requests: [leave('2026-03-02', '2026-03-06', { leave_type: 'unpaid' }), leave('2026-03-09', '2026-03-13', { status: 'pending' })],
    })
    expect(r.used).toBe(0)
  })

  it('no allowance means no statutory holiday', () => {
    expect(leaverHolidayDays({ ...base, entitlementDays: null, requests: [] }).status).toBe('self_employed')
  })
})

describe('leaverHolidayHours', () => {
  const base = {
    staff: { start_date: '2020-01-01', working_days: [1, 2] },
    lastDay: '2026-06-30',
    today: '2026-10-10',
    now: NOW,
  }

  it('NI: 5.6 × average week × share of the year, less leave used', () => {
    const r = leaverHolidayHours({
      ...base,
      region: 'ni',
      events: twelveWeeks(),
      requests: [
        leave('2026-05-04', '2026-05-05', { paid_hours: 16 }),
        leave('2026-06-29', '2026-07-02', { paid_hours: 32 }),  // half falls before they leave
        leave('2026-08-10', '2026-08-11', { paid_hours: 16 }),  // after: doesn't count
      ],
      paidOut: [{ hours: 5 }],
    })
    expect(r).toMatchObject({ status: 'ok', unit: 'hours', avgWeekHours: 20, fullYear: 112, earned: 55.5, used: 37, owed: 18.5 })
  })

  it('carried-over hours are owed on top', () => {
    const r = leaverHolidayHours({ ...base, region: 'gb', events: twelveWeeks(), requests: [], carriedOver: [{ hours: 6 }] })
    expect(r).toMatchObject({ earned: 29, carriedOver: 6, owed: 35 })
  })

  it('GB with an April holiday year only counts hours worked since 1 April', () => {
    const r = leaverHolidayHours({
      ...base,
      region: 'gb',
      holidayYear: holidayYearContaining('2026-06-30', 4),
      events: [...shift('2026-03-30', 10), ...shift('2026-04-06', 10)],
      requests: [],
    })
    expect(r.earned).toBe(1.2)  // 10h × 12.07%
  })

  it('GB: 12.07% of hours worked up to the last day', () => {
    const r = leaverHolidayHours({
      ...base,
      region: 'gb',
      events: [...twelveWeeks(), ...shift('2026-07-06', 10)],  // a shift after leaving isn't theirs to count
      requests: [],
    })
    expect(r.earned).toBe(29)
    expect(r.owed).toBe(29)
    expect(r.fullYear).toBeNull()
  })

  it('NI with no worked weeks says so rather than showing a quiet zero', () => {
    const r = leaverHolidayHours({ ...base, region: 'ni', events: [], requests: [] })
    expect(r.noAverage).toBe(true)
    expect(r.earned).toBe(0)
  })

  it('estimates leave with no hours recorded and flags it', () => {
    const r = leaverHolidayHours({ ...base, region: 'ni', events: twelveWeeks(), requests: [leave('2026-05-04', '2026-05-05')] })
    expect(r.used).toBe(20)  // Mon + Tue of a Mon–Tue pattern = one 20-hour week
    expect(r.usedIsEstimate).toBe(true)
  })

  it('needs the venue region, and self-employed people have none', () => {
    expect(leaverHolidayHours({ ...base, region: null, events: [], requests: [] }).status).toBe('needs_region')
    expect(leaverHolidayHours({ ...base, region: 'gb', staff: { holiday_pay_eligible: false }, events: [], requests: [] }).status).toBe('self_employed')
  })
})

describe('leaverHolidayPay', () => {
  it('hours × hourly rate', () => {
    expect(leaverHolidayPay({ status: 'ok', unit: 'hours', owed: 18.5 }, { hourlyRate: 12.5 })).toBe(231.25)
  })

  it('days × contracted hours per day × rate', () => {
    expect(leaverHolidayPay({ status: 'ok', unit: 'days', owed: 6.9 }, { hourlyRate: 12, contractedHours: 35, workingDays: [1, 2, 3, 4, 5] })).toBe(579.6)
  })

  it('negative when they owe it back', () => {
    expect(leaverHolidayPay({ status: 'ok', unit: 'hours', owed: -4 }, { hourlyRate: 12 })).toBe(-48)
  })

  it('nothing to go on → null, never £0', () => {
    expect(leaverHolidayPay({ status: 'ok', unit: 'hours', owed: 10 }, {})).toBeNull()
    expect(leaverHolidayPay({ status: 'ok', unit: 'days', owed: 2 }, { hourlyRate: 12 })).toBeNull()
  })
})
