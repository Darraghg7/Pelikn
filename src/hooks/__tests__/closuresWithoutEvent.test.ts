import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { closuresWithoutEvent, type CalendarEvent } from '../useManagerCalendar'

const closure = (id: string, start: string, end: string, extra = {}) =>
  ({ id, venue_id: 'v', start_date: start, end_date: end, ...extra })

const event = (type: CalendarEvent['type'], start: string, end: string) =>
  ({ id: 'e-' + start, venue_id: 'v', title: 'x', type, colour: 'rust', start_date: start, end_date: end,
     all_day: true, reminder_days: 1, backup_reminder: false }) as CalendarEvent

describe('closuresWithoutEvent', () => {
  it('keeps a Rota / Venue Settings closure that has no calendar event', () => {
    const out = closuresWithoutEvent([closure('c1', '2026-11-05', '2026-11-05', { reason: 'Refit' })], [])
    expect(out).toEqual([{ id: 'c1', title: 'Refit', start_date: '2026-11-05', end_date: '2026-11-05' }])
  })

  it('hides a closure linked to a calendar event (migration 140)', () => {
    expect(closuresWithoutEvent([closure('c1', '2026-12-24', '2026-12-26', { calendar_event_id: 'e1' })], [])).toEqual([])
  })

  it('hides an unlinked closure matching a closed event by dates (087 copy, before 140)', () => {
    expect(closuresWithoutEvent([closure('c1', '2026-12-24', '2026-12-26')], [event('closed', '2026-12-24', '2026-12-26')])).toEqual([])
  })

  it('does not treat a non-closed event on the same dates as the closure', () => {
    const out = closuresWithoutEvent([closure('c1', '2026-12-24', '2026-12-24')], [event('meeting', '2026-12-24', '2026-12-24')])
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Closed')
  })
})
