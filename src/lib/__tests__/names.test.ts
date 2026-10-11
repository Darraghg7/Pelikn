import { describe, it, expect } from 'vitest'
import { initials, shortName, firstName } from '../names'

describe('initials', () => {
  it('uses first and last initial', () => {
    expect(initials('Eve Turbitt')).toBe('ET')
    expect(initials('Mary Anne Smith')).toBe('MS')
  })

  it('gives two letters for a single name', () => {
    expect(initials('Sarah')).toBe('SA')
    expect(initials('Al')).toBe('AL')
    expect(initials('J')).toBe('J')
  })

  it('falls back to ? for empty or missing names', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
    expect(initials(null)).toBe('?')
    expect(initials(undefined)).toBe('?')
  })

  it('ignores extra spaces', () => {
    expect(initials('  Eve   Turbitt  ')).toBe('ET')
    expect(initials('Eve\tTurbitt')).toBe('ET')
  })

  it('handles apostrophes and hyphens', () => {
    expect(initials("James O'Brien")).toBe('JO')
    expect(initials("O'Brien")).toBe('OB')
    expect(initials('Mary-Kate Olsen')).toBe('MO')
    expect(initials('Mary-Kate')).toBe('MK')
    expect(initials('Anne Smith-Jones')).toBe('AS')
  })

  it('lowercase names come out upper case', () => {
    expect(initials('eve turbitt')).toBe('ET')
  })

  it('skips emoji and punctuation', () => {
    expect(initials('🍕 Pizza Joe')).toBe('PJ')
    expect(initials('Joe 🍕')).toBe('JO')
    expect(initials('"Big" Mike')).toBe('BM')
    expect(initials('🍕')).toBe('?')
  })

  it('handles non-Latin and accented first letters', () => {
    expect(initials('Łukasz Żak')).toBe('ŁŻ')
    expect(initials('Émile Zola')).toBe('ÉZ')
    expect(initials('Иван Петров')).toBe('ИП')
    expect(initials('张伟')).toBe('张伟')
    expect(initials('Siobhán Ní Bhriain')).toBe('SB')
  })

  it('keeps a decomposed accent with its letter', () => {
    // "E" + combining acute, as some keyboards type it
    expect(initials('Émile Zola')).toBe('ÉZ')
  })
})

describe('shortName', () => {
  it('shortens to first name and last initial', () => {
    expect(shortName('Darragh Guy')).toBe('Darragh G.')
    expect(shortName('Mary Anne Smith')).toBe('Mary S.')
    expect(shortName("James O'Brien")).toBe('James O.')
    expect(shortName('Jean-Luc Picard')).toBe('Jean-Luc P.')
  })

  it('leaves a single name alone', () => {
    expect(shortName('Sarah')).toBe('Sarah')
    expect(shortName('  Sarah  ')).toBe('Sarah')
  })

  it('returns an empty string for empty names', () => {
    expect(shortName('')).toBe('')
    expect(shortName(null)).toBe('')
    expect(shortName(undefined)).toBe('')
  })

  it('handles non-Latin and emoji', () => {
    expect(shortName('Łukasz żak')).toBe('Łukasz Ż.')
    expect(shortName('Joe 🍕')).toBe('Joe')
  })
})

describe('firstName', () => {
  it('returns the first word', () => {
    expect(firstName('Darragh Guy')).toBe('Darragh')
    expect(firstName('  Sarah ')).toBe('Sarah')
    expect(firstName('')).toBe('')
    expect(firstName(null)).toBe('')
  })
})
