import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
const from = vi.fn(() => ({ insert }))
const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://public/cert.pdf' } }))
const storageFrom = vi.fn(() => ({ getPublicUrl }))

vi.mock('../supabase', () => ({
  supabase: { from, storage: { from: storageFrom } },
}))

const { insertTrainingRecord } = await import('../api/training')
const { TRAINING_BUCKET } = await import('../trainingFiles')

const ROW = { staff_id: 'staff-1', title: 'Level 2 Food Safety', venue_id: 'venue-1' }
const FILE_PATH = 'venue-1/staff-1/1-level2.pdf'
const missingColumn = {
  code: 'PGRST204',
  message: "Could not find the 'file_path' column of 'staff_training' in the schema cache",
}

const payloads = () => insert.mock.calls.map(([p]) => p)

describe('insertTrainingRecord', () => {
  beforeEach(() => {
    insert.mockReset()
    insert.mockResolvedValue({ data: null, error: null })
  })

  // PostgREST rejects the whole row over an unknown column, so a certificate
  // with no file must not name file_path at all.
  it('leaves file_path out entirely when no file was uploaded', async () => {
    await insertTrainingRecord({ ...ROW, file_name: null })
    expect(payloads()[0]).not.toHaveProperty('file_path')
    expect(payloads()[0]).toMatchObject(ROW)
  })

  it('records the storage key when a file was uploaded', async () => {
    await insertTrainingRecord(ROW, FILE_PATH)
    expect(from).toHaveBeenCalledWith('staff_training')
    expect(payloads()[0]).toMatchObject({ file_path: FILE_PATH })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  // 086 is applied by hand, so the column can be missing in production while
  // this code is live. The certificate still has to be recorded.
  it('falls back to the legacy public URL when the column is missing', async () => {
    insert
      .mockResolvedValueOnce({ data: null, error: missingColumn })
      .mockResolvedValueOnce({ data: null, error: null })

    const res = await insertTrainingRecord(ROW, FILE_PATH)

    expect(storageFrom).toHaveBeenCalledWith(TRAINING_BUCKET)
    expect(getPublicUrl).toHaveBeenCalledWith(FILE_PATH)
    expect(payloads()[1]).toEqual({ ...ROW, file_url: 'https://public/cert.pdf' })
    expect(payloads()[1]).not.toHaveProperty('file_path')
    expect(res.error).toBeNull()
  })

  it('does not retry other failures', async () => {
    const denied = { code: '42501', message: 'new row violates row-level security policy' }
    insert.mockResolvedValue({ data: null, error: denied })

    const res = await insertTrainingRecord(ROW, FILE_PATH)

    expect(insert).toHaveBeenCalledTimes(1)
    expect(res.error).toBe(denied)
  })
})
