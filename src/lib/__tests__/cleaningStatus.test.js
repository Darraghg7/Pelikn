import { describe, it, expect } from 'vitest'
import { cleaningStatus } from '../../hooks/useCleaningTasks'

const task = (frequency) => ({ id: 't1', title: 'Clean the walls', frequency, is_active: true, venue_id: 'v1' })
const doneAt = (iso) => ({ id: 'c1', cleaning_task_id: 't1', completed_at: iso, venue_id: 'v1' })

// Monday 6 Jul 2026, 09:00
const MONDAY = '2026-07-06T09:00:00.000Z'
const at = (iso) => new Date(iso)

describe('cleaningStatus', () => {
  it('is overdue when nobody has ever done it', () => {
    expect(cleaningStatus(task('weekly'), null, at(MONDAY))).toBe('overdue')
  })

  // The reported bug: a weekly task ticked by one person reappeared on
  // everyone else's list the next day.
  describe('a weekly task ticked on Monday', () => {
    const walls = task('weekly')
    const monday = doneAt(MONDAY)

    it('stays off the list on Tuesday', () => {
      expect(cleaningStatus(walls, monday, at('2026-07-07T09:00:00.000Z'))).toBe('done')
    })

    it('stays off the list on Friday', () => {
      expect(cleaningStatus(walls, monday, at('2026-07-10T09:00:00.000Z'))).toBe('done')
    })

    it('is flagged as approaching late in the week', () => {
      expect(cleaningStatus(walls, monday, at('2026-07-12T09:00:00.000Z'))).toBe('due_soon')
    })

    it('is not yet overdue just before the week is up', () => {
      expect(cleaningStatus(walls, monday, at('2026-07-13T08:00:00.000Z'))).not.toBe('overdue')
    })

    it('comes back the next Monday', () => {
      expect(cleaningStatus(walls, monday, at('2026-07-13T10:00:00.000Z'))).toBe('overdue')
    })
  })

  describe('daily tasks turn over on the calendar day', () => {
    const bins = task('daily')

    it('is done later the same day', () => {
      expect(cleaningStatus(bins, doneAt(MONDAY), at('2026-07-06T22:00:00.000Z'))).toBe('done')
    })

    it('is overdue again the next morning', () => {
      expect(cleaningStatus(bins, doneAt(MONDAY), at('2026-07-07T07:00:00.000Z'))).toBe('overdue')
    })
  })

  it('treats an unrecognised frequency as daily', () => {
    const odd = task('whenever')
    expect(cleaningStatus(odd, doneAt(MONDAY), at('2026-07-06T22:00:00.000Z'))).toBe('done')
    expect(cleaningStatus(odd, doneAt(MONDAY), at('2026-07-07T07:00:00.000Z'))).toBe('overdue')
  })

  it('scales the window to the frequency', () => {
    const monthly = task('monthly')
    expect(cleaningStatus(monthly, doneAt(MONDAY), at('2026-07-20T09:00:00.000Z'))).toBe('done')
    expect(cleaningStatus(monthly, doneAt(MONDAY), at('2026-08-10T09:00:00.000Z'))).toBe('overdue')
  })

  it('defaults to now when no reference date is given', () => {
    const justNow = doneAt(new Date().toISOString())
    expect(cleaningStatus(task('weekly'), justNow)).toBe('done')
  })
})
