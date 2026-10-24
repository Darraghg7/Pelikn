import { describe, it, expect } from 'vitest'
import { timesheetPeriod, eventsForPeriod, PERIOD_EDGE_MS } from '../timesheet'

describe('timesheetPeriod', () => {
  it('this week runs Monday to Sunday in London, even in summer time', () => {
    // Saturday 24 Oct 2026, BST. The old code started this period on Sun 18 Oct.
    const p = timesheetPeriod('this_week', null, null, '2026-10-24')
    expect(p.periodFrom).toBe('2026-10-19')
    expect(p.periodTo).toBe('2026-10-25')
    expect(p.dateFrom).toBe('2026-10-18T23:00:00.000Z')   // Mon 00:00 BST
    // The clocks go back on Sun 25 Oct, so the week ends at 23:59:59.999 GMT.
    expect(p.dateTo).toBe('2026-10-25T23:59:59.999Z')
  })

  it('last week is the seven days before this Monday', () => {
    const p = timesheetPeriod('last_week', null, null, '2026-10-19')   // a Monday
    expect(p).toMatchObject({ periodFrom: '2026-10-12', periodTo: '2026-10-18' })
  })

  it('this month starts on the 1st, not the last day of the previous month', () => {
    // The old code gave '2026-09-30' here, so a 30 Sep payout was paid twice.
    const p = timesheetPeriod('this_month', null, null, '2026-10-24')
    expect(p).toMatchObject({ periodFrom: '2026-10-01', periodTo: '2026-10-31' })
    expect(p.dateFrom).toBe('2026-09-30T23:00:00.000Z')   // 1 Oct 00:00 BST
  })

  it('last month handles January and leap years', () => {
    expect(timesheetPeriod('last_month', null, null, '2026-01-15')).toMatchObject({ periodFrom: '2025-12-01', periodTo: '2025-12-31' })
    expect(timesheetPeriod('last_month', null, null, '2028-03-10')).toMatchObject({ periodFrom: '2028-02-01', periodTo: '2028-02-29' })
  })

  it('winter periods use GMT midnight', () => {
    const p = timesheetPeriod('this_week', null, null, '2026-12-02')
    expect(p).toMatchObject({ periodFrom: '2026-11-30', periodTo: '2026-12-06', dateFrom: '2026-11-30T00:00:00.000Z' })
  })

  it('custom ranges are taken as given, and need both dates', () => {
    expect(timesheetPeriod('custom', '2026-07-01', '2026-07-14', '2026-10-24')).toMatchObject({ periodFrom: '2026-07-01', periodTo: '2026-07-14' })
    expect(timesheetPeriod('custom', '2026-07-01', '', '2026-10-24')).toBeNull()
  })
})

describe('eventsForPeriod', () => {
  const week = timesheetPeriod('this_week', null, null, '2026-10-24')   // 19–25 Oct
  const ev = (staff, type, iso, id = `${staff}-${type}-${iso}`) => ({ id, staff_id: staff, event_type: type, occurred_at: iso })

  it('keeps a shift that started in the period but finished after it', () => {
    // Sun 25 Oct 21:00 GMT → Mon 26 Oct 01:00 GMT.
    const events = [ev('a', 'clock_in', '2026-10-25T21:00:00Z'), ev('a', 'clock_out', '2026-10-26T01:00:00Z')]
    expect(eventsForPeriod(events, week.dateFrom, week.dateTo)).toEqual(events)
  })

  it('leaves out a shift that started before the period, even if it ended inside it', () => {
    // Sun 18 Oct 22:00 BST → Mon 19 Oct 02:00 BST belongs to the week before.
    const events = [
      ev('a', 'clock_in', '2026-10-18T21:00:00Z'), ev('a', 'clock_out', '2026-10-19T01:00:00Z'),
      ev('a', 'clock_in', '2026-10-20T08:00:00Z'), ev('a', 'clock_out', '2026-10-20T16:00:00Z'),
    ]
    expect(eventsForPeriod(events, week.dateFrom, week.dateTo).map(e => e.occurred_at))
      .toEqual(['2026-10-20T08:00:00Z', '2026-10-20T16:00:00Z'])
  })

  it('pays a boundary shift in exactly one of two neighbouring periods', () => {
    const next = timesheetPeriod('this_week', null, null, '2026-10-26')   // 26 Oct – 1 Nov
    const events = [ev('a', 'clock_in', '2026-10-25T21:00:00Z'), ev('a', 'break_start', '2026-10-25T23:30:00Z'),
                    ev('a', 'break_end', '2026-10-25T23:45:00Z'), ev('a', 'clock_out', '2026-10-26T01:00:00Z')]
    const inThis = eventsForPeriod(events, week.dateFrom, week.dateTo)
    const inNext = eventsForPeriod(events, next.dateFrom, next.dateTo)
    expect(inThis).toHaveLength(4)
    expect(inNext).toHaveLength(0)
  })

  it('tracks each staff member separately', () => {
    const events = [
      ev('a', 'clock_out', '2026-10-19T00:30:00Z'),            // tail of an earlier shift
      ev('b', 'clock_in', '2026-10-19T07:00:00Z'), ev('b', 'clock_out', '2026-10-19T15:00:00Z'),
    ]
    expect(eventsForPeriod(events, week.dateFrom, week.dateTo).map(e => e.staff_id)).toEqual(['b', 'b'])
  })

  it('reads a day either side', () => {
    expect(PERIOD_EDGE_MS).toBe(24 * 60 * 60 * 1000)
  })
})
