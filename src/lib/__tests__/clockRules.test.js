import { describe, it, expect, beforeEach } from 'vitest'
import {
  RULES_OFF, distanceMetres, decideClockRules, needsPosition, clockBlockedNotice,
  saveTabletCredentials, MAX_ACCURACY_M,
} from '../clockRules'

const VENUE = 'v1'
const cafe = { latitude: 51.5, longitude: -0.1 }
// 1 m of latitude is about 1/111,320 of a degree
const here = (northM = 0, accuracy = 10) => ({
  latitude: cafe.latitude + northM / 111_320, longitude: cafe.longitude, accuracy,
})
const fence = (over = {}) => ({ ...RULES_OFF, require_location: true, ...cafe, radius_m: 50, ...over })
const tabletRules = (over = {}) => ({ ...RULES_OFF, require_device: true, device_id: 'd1', device_name: 'Till tablet', ...over })

beforeEach(() => localStorage.clear())

describe('distanceMetres', () => {
  it('is zero for the same point and about 111 km per degree of latitude', () => {
    expect(distanceMetres(cafe, cafe)).toBe(0)
    const d = distanceMetres(cafe, { latitude: 52.5, longitude: -0.1 })
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('with no rules on', () => {
  it('lets every event through and sends nothing extra', () => {
    expect(decideClockRules({ rules: RULES_OFF, eventType: 'clock_in', venueId: VENUE })).toEqual({ ok: true, args: {} })
    expect(needsPosition(RULES_OFF, 'clock_in')).toBe(false)
  })
})

describe('location rule', () => {
  it('allows a punch inside the radius and sends the position', () => {
    const p = here(20)
    const r = decideClockRules({ rules: fence(), eventType: 'clock_in', venueId: VENUE, position: p })
    expect(r.ok).toBe(true)
    expect(r.args).toMatchObject({ p_latitude: p.latitude, p_longitude: p.longitude, p_accuracy_m: 10 })
  })

  it('refuses the car park (outside the radius)', () => {
    const r = decideClockRules({ rules: fence(), eventType: 'clock_out', venueId: VENUE, position: here(90) })
    expect(r).toMatchObject({ ok: false, message: 'You need to be at the venue to clock in.' })
  })

  it('refuses a fix too loose to tell cafe from car park', () => {
    const r = decideClockRules({ rules: fence(), eventType: 'clock_in', venueId: VENUE, position: here(0, MAX_ACCURACY_M + 1) })
    expect(r.ok).toBe(false)
  })

  it('refuses when no position is available', () => {
    expect(decideClockRules({ rules: fence(), eventType: 'clock_in', venueId: VENUE }).ok).toBe(false)
  })

  it('never gates breaks', () => {
    expect(needsPosition(fence(), 'break_start')).toBe(false)
    expect(decideClockRules({ rules: fence(), eventType: 'break_end', venueId: VENUE })).toEqual({ ok: true, args: {} })
  })

  it('does nothing until a venue spot has been saved', () => {
    expect(needsPosition(fence({ latitude: null, longitude: null }), 'clock_in')).toBe(false)
  })
})

describe('tablet rule', () => {
  it('refuses a device that is not the tablet', () => {
    const r = decideClockRules({ rules: tabletRules(), eventType: 'clock_in', venueId: VENUE })
    expect(r).toMatchObject({ ok: false, message: 'Clock in on Till tablet.' })
  })

  it('refuses a device holding an old tablet registration', () => {
    saveTabletCredentials(VENUE, { device_id: 'old', token: 't' })
    expect(decideClockRules({ rules: tabletRules(), eventType: 'clock_in', venueId: VENUE }).ok).toBe(false)
  })

  it('lets the registered tablet through with its secret', () => {
    saveTabletCredentials(VENUE, { device_id: 'd1', token: 'secret' })
    expect(decideClockRules({ rules: tabletRules(), eventType: 'clock_in', venueId: VENUE }))
      .toEqual({ ok: true, args: { p_device_token: 'secret' } })
  })

  it('does not ask the tablet for GPS even when the location rule is on too', () => {
    const both = tabletRules({ require_location: true, ...cafe })
    expect(needsPosition(both, 'clock_in')).toBe(false)
    saveTabletCredentials(VENUE, { device_id: 'd1', token: 'secret' })
    expect(decideClockRules({ rules: both, eventType: 'clock_in', venueId: VENUE }).ok).toBe(true)
  })

  it('still lets any device take a break', () => {
    expect(decideClockRules({ rules: tabletRules(), eventType: 'break_start', venueId: VENUE }).ok).toBe(true)
  })
})

describe('clockBlockedNotice', () => {
  it('names the tablet on other devices, and is silent on the tablet itself', () => {
    expect(clockBlockedNotice(tabletRules(), VENUE)).toBe('Clock in on Till tablet.')
    saveTabletCredentials(VENUE, { device_id: 'd1', token: 'secret' })
    expect(clockBlockedNotice(tabletRules(), VENUE)).toBeNull()
    expect(clockBlockedNotice(fence(), VENUE)).toBeNull()
  })
})
