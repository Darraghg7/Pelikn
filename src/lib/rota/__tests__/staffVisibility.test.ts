import { describe, it, expect } from 'vitest'
import { shiftsVisibleToStaff } from '..'

const shift = (week_start: string, id = week_start) => ({ id, week_start })

describe('shiftsVisibleToStaff', () => {
  const current = '2026-10-19'

  it('hides a future week that has not been published', () => {
    const shifts = [shift('2026-10-26')]
    expect(shiftsVisibleToStaff(shifts, {}, current)).toEqual([])
    expect(shiftsVisibleToStaff(shifts, { '2026-10-26': false }, current)).toEqual([])
  })

  it('shows a future week once it is published', () => {
    const shifts = [shift('2026-10-26')]
    expect(shiftsVisibleToStaff(shifts, { '2026-10-26': true }, current)).toEqual(shifts)
  })

  it('keeps this week and earlier weeks visible even if never marked published', () => {
    const shifts = [shift('2026-10-12'), shift('2026-10-19')]
    expect(shiftsVisibleToStaff(shifts, {}, current)).toEqual(shifts)
  })

  it('filters per week when both are loaded', () => {
    const shifts = [shift('2026-10-19', 'a'), shift('2026-10-26', 'b')]
    expect(shiftsVisibleToStaff(shifts, { '2026-10-26': false }, current).map((s) => s.id)).toEqual(['a'])
  })
})
