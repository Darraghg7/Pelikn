import { beforeEach, describe, expect, it } from 'vitest'
import { cachePinRecord, checkPinRecord, createPinRecord, pinHashKey } from '../offlinePin'

const ID = 'staff-1'

describe('offline PIN record', () => {
  beforeEach(() => localStorage.clear())

  it('is salted, so the same PIN gives a different record each time', async () => {
    const a = await createPinRecord(ID, '1234')
    const b = await createPinRecord(ID, '1234')
    expect(a).toMatch(/^v2:[0-9a-f]{32}:[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })

  it('accepts the right PIN and rejects a wrong one', async () => {
    await cachePinRecord(ID, '1234')
    expect(await checkPinRecord(ID, '1234')).toBe('ok')
    expect(await checkPinRecord(ID, '9999')).toBe('wrong')
  })

  it('locks after 5 wrong PINs, even for the right PIN, until an online sign-in', async () => {
    await cachePinRecord(ID, '1234')
    for (let i = 0; i < 5; i++) expect(await checkPinRecord(ID, '0000')).toBe('wrong')
    expect(await checkPinRecord(ID, '1234')).toBe('locked')
    await cachePinRecord(ID, '1234')
    expect(await checkPinRecord(ID, '1234')).toBe('ok')
  })

  it('a correct PIN clears earlier wrong tries', async () => {
    await cachePinRecord(ID, '1234')
    for (let i = 0; i < 4; i++) await checkPinRecord(ID, '0000')
    expect(await checkPinRecord(ID, '1234')).toBe('ok')
    for (let i = 0; i < 4; i++) expect(await checkPinRecord(ID, '0000')).toBe('wrong')
  })

  it('treats a missing or old unsalted record as no offline data', async () => {
    expect(await checkPinRecord(ID, '1234')).toBe('none')
    localStorage.setItem(pinHashKey(ID), 'a'.repeat(64))
    expect(await checkPinRecord(ID, '1234')).toBe('none')
  })
})
