import { describe, expect, it } from 'vitest'
import { planTotal } from '../pricing'

describe('planTotal', () => {
  it('prices Starter per venue', () => {
    expect(planTotal('starter', 'month', 1)).toBe(15)
    expect(planTotal('starter', 'month', 3)).toBe(45)
  })
  it('prices Pro as first venue plus extras', () => {
    expect(planTotal('pro', 'month', 1)).toBe(30)
    expect(planTotal('pro', 'month', 3)).toBe(60)
    expect(planTotal('pro', 'year', 2)).toBe(450)
  })
  it('adds the QR add-on', () => {
    expect(planTotal('starter', 'month', 1, true)).toBe(16)
    expect(planTotal('pro', 'year', 1, true)).toBe(310)
  })
})
