import { describe, it, expect } from 'vitest'
import { paidHoursFor, shiftCost, stationFromRole, stationColor, STATION_COLOR } from '..'
import { colors } from '../../tokens'

describe('paidHoursFor / shiftCost', () => {
  const adult = { hourly_rate: 12, is_under_18: false }
  const young = { hourly_rate: 10, is_under_18: true }

  it('takes the venue break off an adult shift over 6h', () => {
    expect(paidHoursFor('09:00', '17:00', adult, 45)).toBe(7.25)
    expect(shiftCost('09:00', '17:00', adult, 45)).toBe(87)
  })
  it('takes a fixed 30 minutes off an under-18 shift over 4.5h, whatever the venue says', () => {
    expect(paidHoursFor('10:00', '15:00', young, 45)).toBe(4.5)
  })
  it('handles an overnight shift', () => {
    expect(paidHoursFor('18:00', '02:00', adult, 30)).toBe(7.5)
  })
  it('costs £0 with no rate, and treats a missing person as an adult', () => {
    expect(shiftCost('09:00', '17:00', { hourly_rate: null }, 30)).toBe(0)
    expect(paidHoursFor('09:00', '17:00', undefined, 30)).toBe(7.5)
  })
})

describe('stations', () => {
  it('maps role names to stations', () => {
    expect(stationFromRole('Head Chef')).toBe('Kitchen')
    expect(stationFromRole('Kitchen Porter')).toBe('Kitchen') // "kitchen" matches before "porter"
    expect(stationFromRole('Pot porter')).toBe('KP')
    expect(stationFromRole('Barista')).toBe('Bar')
    expect(stationFromRole('Floor supervisor')).toBe('FOH')
    expect(stationFromRole('Manager')).toBe('Manager')
    expect(stationFromRole('')).toBeNull()
  })
  it('colours by station, brand colour when there is none', () => {
    expect(stationColor('Chef')).toBe(STATION_COLOR.Kitchen)
    expect(stationColor('Manager')).toBe(colors.brand.DEFAULT)
    expect(stationColor(null)).toBe(colors.brand.DEFAULT)
  })
})
