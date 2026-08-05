import { describe, it, expect, vi, beforeEach } from 'vitest'

const single = vi.fn()
const select = vi.fn(() => ({ single }))
const insert = vi.fn(() => ({ select }))
const from = vi.fn(() => ({ insert }))
const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://public/photo.jpg' } }))
const storageFrom = vi.fn(() => ({ getPublicUrl }))

vi.mock('../supabase', () => ({
  supabase: { from, storage: { from: storageFrom } },
}))

const { insertDeliveryCheck } = await import('../api/deliveries')
const { TRAINING_BUCKET } = await import('../trainingFiles')

const ROW = { supplier_name: 'Bidfood', venue_id: 'venue-1' }
const missingColumn = {
  code: 'PGRST204',
  message: "Could not find the 'photo_path' column of 'delivery_checks' in the schema cache",
}

const payloads = () => insert.mock.calls.map(([p]) => p)

describe('insertDeliveryCheck', () => {
  beforeEach(() => {
    insert.mockClear()
    single.mockReset()
    single.mockResolvedValue({ data: { id: 'check-1' }, error: null })
  })

  // A check with no photo must not name the column at all: PostgREST rejects the
  // whole row over an unknown column, even one set to null.
  it('leaves photo_path out entirely when there is no photo', async () => {
    await insertDeliveryCheck(ROW, null)
    expect(payloads()[0]).not.toHaveProperty('photo_path')
    expect(payloads()[0]).toMatchObject(ROW)
  })

  it('records the storage key when a photo was uploaded', async () => {
    await insertDeliveryCheck(ROW, 'venue-1/delivery-photos/1-crate.jpg')
    expect(payloads()[0]).toMatchObject({ photo_path: 'venue-1/delivery-photos/1-crate.jpg' })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  // 086 has to be applied by hand, so the column can be missing in production
  // while this code is live. The delivery still has to be loggable.
  it('falls back to the legacy public URL when the column is missing', async () => {
    single
      .mockResolvedValueOnce({ data: null, error: missingColumn })
      .mockResolvedValueOnce({ data: { id: 'check-1' }, error: null })

    const res = await insertDeliveryCheck(ROW, 'venue-1/delivery-photos/1-crate.jpg')

    expect(storageFrom).toHaveBeenCalledWith(TRAINING_BUCKET)
    expect(getPublicUrl).toHaveBeenCalledWith('venue-1/delivery-photos/1-crate.jpg')
    expect(payloads()[1]).toEqual({ ...ROW, photo_url: 'https://public/photo.jpg' })
    expect(payloads()[1]).not.toHaveProperty('photo_path')
    expect(res.error).toBeNull()
    expect(res.data).toEqual({ id: 'check-1' })
  })

  it('does not retry other failures', async () => {
    const denied = { code: '42501', message: 'new row violates row-level security policy' }
    single.mockResolvedValue({ data: null, error: denied })

    const res = await insertDeliveryCheck(ROW, 'venue-1/delivery-photos/1-crate.jpg')

    expect(insert).toHaveBeenCalledTimes(1)
    expect(res.error).toBe(denied)
  })
})
