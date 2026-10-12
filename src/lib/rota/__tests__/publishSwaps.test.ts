import { describe, it, expect, vi, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({
  upsertRotaPublished: vi.fn(),
  updateShiftStaff: vi.fn(),
  resolveShiftSwap: vi.fn(),
}))
vi.mock('../../api/shifts', () => api)
const sendPush = vi.hoisted(() => vi.fn())
vi.mock('../../sendPush', () => ({ sendPush }))

import {
  canPublishWeek, publishButtonLabel, staffToNotify, publishRota,
  isSwapExpired, approveSwapRequest, declineSwapRequest, EXPIRED_SWAP_NOTE,
} from '..'

beforeEach(() => {
  vi.clearAllMocks()
  api.upsertRotaPublished.mockResolvedValue({ error: null })
  api.updateShiftStaff.mockResolvedValue({ error: null })
  api.resolveShiftSwap.mockResolvedValue({ error: null })
})

describe('publish state', () => {
  it('can publish with unpublished edits, or a never-published week that has shifts', () => {
    expect(canPublishWeek({ pendingChanges: 2, publishedState: true, shiftCount: 5 })).toBe(true)
    expect(canPublishWeek({ pendingChanges: 0, publishedState: false, shiftCount: 5 })).toBe(true)
  })
  it('cannot publish an empty never-published week, a published week with no edits, or while unknown', () => {
    expect(canPublishWeek({ pendingChanges: 0, publishedState: false, shiftCount: 0 })).toBe(false)
    expect(canPublishWeek({ pendingChanges: 0, publishedState: true, shiftCount: 5 })).toBe(false)
    expect(canPublishWeek({ pendingChanges: 0, publishedState: null, shiftCount: 5 })).toBe(false)
  })
  it('labels the button', () => {
    expect(publishButtonLabel({ publishing: true, canPublish: true, publishedState: true })).toBe('Publishing…')
    expect(publishButtonLabel({ publishing: false, canPublish: true, publishedState: true })).toBe('Publish')
    expect(publishButtonLabel({ publishing: false, canPublish: false, publishedState: true })).toBe('Published')
    expect(publishButtonLabel({ publishing: false, canPublish: false, publishedState: false })).toBe('Publish')
  })
  it('notifies each person on the rota once', () => {
    expect(staffToNotify([{ staff_id: 'a' }, { staff_id: 'b' }, { staff_id: 'a' }, { staff_id: null }])).toEqual(['a', 'b'])
  })
  it('publishes the week and pushes to everyone on it', async () => {
    const r = await publishRota({ venueId: 'v', weekStartStr: '2026-10-12', shifts: [{ staff_id: 'a' }, { staff_id: 'b' }] })
    expect(r.error).toBeNull()
    expect(api.upsertRotaPublished).toHaveBeenCalledWith('v', '2026-10-12', expect.any(String))
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({
      notificationType: 'rota_published', title: 'Rota Published', staffIds: ['a', 'b'],
      body: 'Your rota for the week of 2026-10-12 is now available.',
    }))
  })
  it('does not push when publishing fails or nobody is on the rota', async () => {
    api.upsertRotaPublished.mockResolvedValueOnce({ error: { message: 'nope' } })
    expect((await publishRota({ venueId: 'v', weekStartStr: 'w', shifts: [{ staff_id: 'a' }] })).error?.message).toBe('nope')
    await publishRota({ venueId: 'v', weekStartStr: 'w', shifts: [] })
    expect(sendPush).not.toHaveBeenCalled()
  })
})

describe('swaps', () => {
  const swap = { id: 'sw', shift_id: 'sh', requester_id: 'ana', target_staff_id: 'ben', shift: { shift_date: '2026-10-12' } }

  it('a swap is expired only when its shift is before today', () => {
    expect(isSwapExpired(swap, '2026-10-13')).toBe(true)
    expect(isSwapExpired(swap, '2026-10-12')).toBe(false)
    expect(isSwapExpired({ shift: null }, '2026-10-13')).toBe(false)
  })
  it('approving moves the shift, marks it approved and tells both people', async () => {
    expect((await approveSwapRequest(swap, 'v')).error).toBeNull()
    expect(api.updateShiftStaff).toHaveBeenCalledWith('sh', 'ben')
    expect(api.resolveShiftSwap).toHaveBeenCalledWith('sw', 'approved')
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ title: 'Shift Swap Approved', staffIds: ['ana', 'ben'] }))
  })
  it('does not mark a swap approved when the shift could not be moved', async () => {
    api.updateShiftStaff.mockResolvedValueOnce({ error: { message: 'blocked' } })
    expect((await approveSwapRequest(swap, 'v')).error?.message).toBe('blocked')
    expect(api.resolveShiftSwap).not.toHaveBeenCalled()
    expect(sendPush).not.toHaveBeenCalled()
  })
  it('declining keeps the note and tells the requester', async () => {
    await declineSwapRequest(swap, 'v', '  Short staffed  ')
    expect(api.resolveShiftSwap).toHaveBeenCalledWith('sw', 'rejected', 'Short staffed')
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Shift Swap Rejected', staffIds: ['ana'], body: 'Your shift swap request was not approved. Note: Short staffed',
    }))
  })
  it('declining with no note stores null and says nothing extra', async () => {
    await declineSwapRequest(swap, 'v', '')
    expect(api.resolveShiftSwap).toHaveBeenCalledWith('sw', 'rejected', null)
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ body: 'Your shift swap request was not approved.' }))
  })
  it('dismissing an expired swap carries the standard note', async () => {
    await declineSwapRequest(swap, 'v', EXPIRED_SWAP_NOTE)
    expect(api.resolveShiftSwap).toHaveBeenCalledWith('sw', 'rejected', 'Shift had already passed')
  })
})
