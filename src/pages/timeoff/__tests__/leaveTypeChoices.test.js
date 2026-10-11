import { describe, it, expect } from 'vitest'
import { leaveTypeChoices } from '../timeOffConstants'

const values = (opts) => leaveTypeChoices(opts).map(t => t.value)

describe('leaveTypeChoices', () => {
  it('staff can only book annual leave (or other) when the venue has unpaid leave switched off', () => {
    expect(values({ allowUnpaid: false })).toEqual(['annual', 'other'])
  })

  it('offers unpaid leave when the venue switches it on', () => {
    expect(values({ allowUnpaid: true })).toEqual(['annual', 'unpaid', 'other'])
  })

  it('managers can always choose unpaid leave', () => {
    expect(values({ allowUnpaid: false, isManager: true })).toEqual(['annual', 'unpaid', 'other'])
  })

  it('Not available is no longer offered, except on a booking that already is one', () => {
    expect(values({ allowUnpaid: true, isManager: true })).not.toContain('unavailable')
    expect(values({ current: 'unavailable' })).toContain('unavailable')
  })

  it('an existing unpaid booking keeps its type visible even with the switch off', () => {
    expect(values({ current: 'unpaid' })).toContain('unpaid')
  })
})
