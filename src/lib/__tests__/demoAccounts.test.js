import { describe, it, expect } from 'vitest'
import { isDemoEmail, visibleVenuesFor } from '../demoAccounts'

const venues = [
  { slug: 'brew-and-bloom' },
  { slug: 'the-corner-cup' },
  { slug: 'real-cafe' },
]

describe('isDemoEmail', () => {
  it('recognises the live demo login', () => {
    expect(isDemoEmail('demo@safeserv.com')).toBe(true)
  })

  it('ignores case and stray spaces', () => {
    expect(isDemoEmail(' Demo@SafeServ.com ')).toBe(true)
  })

  it('is false for real and missing emails', () => {
    expect(isDemoEmail('owner@cafe.co.uk')).toBe(false)
    expect(isDemoEmail(undefined)).toBe(false)
    expect(isDemoEmail('')).toBe(false)
  })
})

describe('visibleVenuesFor', () => {
  it('limits demo logins to demo venues', () => {
    expect(visibleVenuesFor('demo@safeserv.com', venues).map(v => v.slug))
      .toEqual(['brew-and-bloom', 'the-corner-cup'])
  })

  it('leaves everyone else untouched', () => {
    expect(visibleVenuesFor('owner@cafe.co.uk', venues)).toEqual(venues)
  })

  it('copes with no venues', () => {
    expect(visibleVenuesFor('demo@safeserv.com', null)).toEqual([])
    expect(visibleVenuesFor('owner@cafe.co.uk', undefined)).toEqual([])
  })
})
