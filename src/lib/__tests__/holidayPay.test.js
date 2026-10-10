import { describe, it, expect } from 'vitest'
import { leaveYearFor, leaveYearForDateStr } from '../leaveYear'
import { leaveDaysInRange, holidayHoursUsed, adjustmentTotals, zeroHoursLeft } from '../api/holidayPay'

describe('leaveYearFor', () => {
  it('is the calendar year by default', () => {
    expect(leaveYearFor(new Date(2026, 9, 10))).toEqual({ startYear: 2026, from: '2026-01-01', to: '2026-12-31', label: '2026' })
  })
  it('follows a venue year starting in April', () => {
    expect(leaveYearFor(new Date(2026, 9, 10), 4)).toEqual({ startYear: 2026, from: '2026-04-01', to: '2027-03-31', label: '2026/27' })
    expect(leaveYearFor(new Date(2027, 1, 10), 4).from).toBe('2026-04-01')
  })
  it('reads a date string', () => {
    expect(leaveYearForDateStr('2027-03-31', 4).startYear).toBe(2026)
    expect(leaveYearForDateStr('2027-04-01', 4).startYear).toBe(2027)
  })
  it('falls back to January for a bad setting', () => {
    expect(leaveYearFor(new Date(2026, 9, 10), 0).from).toBe('2026-01-01')
  })
})

describe('leaveDaysInRange', () => {
  // Thu 15 – Mon 19 Oct 2026, a Thu–Sun worker
  const req = { id: 'r1', staff_id: 's1', start_date: '2026-10-15', end_date: '2026-10-19' }
  const thuSun = [4, 5, 6, 7]

  it('marks which days are working days', () => {
    const days = leaveDaysInRange([req], [], thuSun, '2026-01-01', '2026-12-31')
    expect(days.map(d => [d.date, d.isWorkingDay])).toEqual([
      ['2026-10-15', true], ['2026-10-16', true], ['2026-10-17', true], ['2026-10-18', true], ['2026-10-19', false],
    ])
  })
  it('only keeps the days inside the range', () => {
    const days = leaveDaysInRange([req], [], thuSun, '2026-10-12', '2026-10-17')
    expect(days.map(d => d.date)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17'])
  })
  it('attaches allocated hours to their day', () => {
    const alloc = [{ id: 'a1', time_off_request_id: 'r1', leave_date: '2026-10-16', hours: '8.00' }]
    const day = leaveDaysInRange([req], alloc, thuSun, '2026-10-16', '2026-10-16')[0]
    expect(day).toMatchObject({ allocationId: 'a1', allocatedHours: 8 })
  })
})

describe('holidayHoursUsed', () => {
  const day = (over) => ({ isWorkingDay: true, allocatedHours: null, ...over })
  it('takes allocated hours exactly, and estimates the rest', () => {
    // 20 h earned, one day paid at 8 h, one booked but not yet paid (6.5 h average)
    expect(holidayHoursUsed([day({ allocatedHours: 8 }), day()], 6.5)).toBe(14.5)
  })
  it('ignores non-working days with nothing allocated', () => {
    expect(holidayHoursUsed([day({ isWorkingDay: false })], 6.5)).toBe(0)
  })
})

describe('carry-over and pay-outs', () => {
  it('totals each kind', () => {
    expect(adjustmentTotals([
      { kind: 'carry_over', hours: '10.00' }, { kind: 'payout', hours: '4.5' }, { kind: 'payout', hours: 2 },
    ])).toEqual({ carriedOver: 10, paidOut: 6.5 })
  })
  it('adds carry-over and takes off what was used and paid out', () => {
    // 20 earned + 10 carried over − 8 taken − 6.5 paid out
    expect(zeroHoursLeft({ accrued: 20, used: 8, carriedOver: 10, paidOut: 6.5 })).toBe(15.5)
    expect(zeroHoursLeft({ accrued: 20, used: 8 })).toBe(12)
  })
})
