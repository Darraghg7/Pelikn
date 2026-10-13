import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiBackedOff, recordApiResult, resetApiHealth, withJitter } from '../apiHealth'

describe('apiHealth', () => {
  beforeEach(() => { resetApiHealth(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T19:00:00Z')) })
  afterEach(() => { vi.useRealTimers(); resetApiHealth() })

  it('stays out of the way until failures pile up', () => {
    recordApiResult(false)
    recordApiResult(false)
    expect(apiBackedOff()).toBe(false)
  })

  it('stands background refreshes down after three failures in a row', () => {
    for (let i = 0; i < 3; i++) recordApiResult(false)
    expect(apiBackedOff()).toBe(true)
  })

  it('lets a probe through after the pause, and waits longer if it fails too', () => {
    for (let i = 0; i < 3; i++) recordApiResult(false)
    vi.advanceTimersByTime(15_001)
    expect(apiBackedOff()).toBe(false)
    recordApiResult(false)
    expect(apiBackedOff()).toBe(true)
    vi.advanceTimersByTime(15_001)
    expect(apiBackedOff()).toBe(true) // second pause is 30 s
    vi.advanceTimersByTime(15_001)
    expect(apiBackedOff()).toBe(false)
  })

  it('never pauses for more than five minutes', () => {
    for (let i = 0; i < 40; i++) recordApiResult(false)
    vi.advanceTimersByTime(5 * 60_000 + 1)
    expect(apiBackedOff()).toBe(false)
  })

  it('a single success clears it', () => {
    for (let i = 0; i < 5; i++) recordApiResult(false)
    recordApiResult(true)
    expect(apiBackedOff()).toBe(false)
    recordApiResult(false)
    expect(apiBackedOff()).toBe(false) // the count starts again
  })

  it('jitter only ever lengthens', () => {
    for (let i = 0; i < 50; i++) {
      const v = withJitter(1000, 0.5)
      expect(v).toBeGreaterThanOrEqual(1000)
      expect(v).toBeLessThanOrEqual(1500)
    }
  })
})
