import { describe, it, expect } from 'vitest'
import { leaveYearFor, leaveYearForDateStr } from '../leaveYear'
import { requestHours, requestHoursInRange, hoursInRange, zeroHoursLeft } from '../api/holidayPay'

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

const thuSun = [4, 5, 6, 7]
// Thu 15 – Mon 19 Oct 2026: four working days for a Thu–Sun worker
const req = (over) => ({ id: 'r1', staff_id: 's1', start_date: '2026-10-15', end_date: '2026-10-19', ...over })

describe('requestHours', () => {
  it('uses the hours booked on the request', () => {
    expect(requestHours(req({ hours: '30.00' }), thuSun, 7)).toBe(30)
  })
  it('estimates older requests from working days × usual day', () => {
    expect(requestHours(req({ hours: null }), thuSun, 7.5)).toBe(30)
  })
  it('is unknown with no hours and no usual day', () => {
    expect(requestHours(req({ hours: null }), thuSun, null)).toBeNull()
  })
})

describe('requestHoursInRange', () => {
  it('counts all of a request inside the range', () => {
    expect(requestHoursInRange(req({ hours: 30 }), thuSun, 7, '2026-10-12', '2026-10-25')).toBe(30)
  })
  it('splits a request across pay weeks by working days', () => {
    // Thu 15 – Sun 18 is one week, Mon 19 the next (not a working day)
    expect(requestHoursInRange(req({ hours: 30 }), thuSun, 7, '2026-10-12', '2026-10-18')).toBe(30)
    expect(requestHoursInRange(req({ hours: 30 }), thuSun, 7, '2026-10-19', '2026-10-25')).toBe(0)
    // Two of the four working days fall in the range
    expect(requestHoursInRange(req({ hours: 30 }), thuSun, 7, '2026-10-17', '2026-10-25')).toBe(15)
  })
  it('splits by calendar days when the leave covers no working days', () => {
    // Holiday pay for Mon–Tue, when they only work Thu–Sun
    const r = { id: 'r2', staff_id: 's1', start_date: '2026-10-19', end_date: '2026-10-20', hours: 8 }
    expect(requestHoursInRange(r, thuSun, 7, '2026-10-19', '2026-10-19')).toBe(4)
  })
  it('sums a list', () => {
    expect(hoursInRange([req({ hours: 30 }), req({ id: 'r3', hours: null })], thuSun, 7, '2026-01-01', '2026-12-31')).toBe(58)
  })
})

describe('zeroHoursLeft', () => {
  it('adds carry-over and takes off approved and awaiting-approval hours', () => {
    // 20 earned + 10 carried over − 8 approved − 6.5 awaiting approval
    expect(zeroHoursLeft({ accrued: 20, carriedOver: 10, approved: 8, pending: 6.5 })).toBe(15.5)
    expect(zeroHoursLeft({ accrued: 20, approved: 8 })).toBe(12)
  })
})
