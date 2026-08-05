import { describe, it, expect, vi, beforeEach } from 'vitest'

const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://public/file.pdf' } }))
vi.mock('../supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl }) } },
}))

const { isMissingColumn, insertWithAttachment } = await import('../attachments')

const OPTS = {
  bucket: 'training-files',
  pathColumn: 'file_path',
  urlColumn: 'file_url',
}

describe('isMissingColumn', () => {
  it('recognises PostgREST refusing a write over an unknown column', () => {
    expect(isMissingColumn({
      code: 'PGRST204',
      message: "Could not find the 'file_path' column of 'staff_training' in the schema cache",
    }, 'file_path')).toBe(true)
  })

  it('recognises Postgres refusing a read over an unknown column', () => {
    expect(isMissingColumn({
      code: '42703',
      message: 'column staff_training.file_path does not exist',
    }, 'file_path')).toBe(true)
  })

  // A missing column is recoverable; a policy denial is not, and retrying it
  // would only write the row a second time if it ever started succeeding.
  it('is false for other failures and for no failure at all', () => {
    expect(isMissingColumn({ code: '42501', message: 'file_path' }, 'file_path')).toBe(false)
    expect(isMissingColumn({ code: 'PGRST204', message: 'photo_path' }, 'file_path')).toBe(false)
    expect(isMissingColumn(null, 'file_path')).toBe(false)
  })
})

describe('insertWithAttachment', () => {
  let insert
  beforeEach(() => {
    insert = vi.fn().mockResolvedValue({ data: null, error: null })
    getPublicUrl.mockClear()
  })

  it('never names the path column when there is no file', async () => {
    await insertWithAttachment(insert, { title: 'x' }, { ...OPTS, path: null })
    expect(insert).toHaveBeenCalledWith({ title: 'x' })
    expect(getPublicUrl).not.toHaveBeenCalled()
  })

  it('passes the caller-built query through untouched on success', async () => {
    const res = { data: { id: 'row-1' }, error: null }
    insert.mockResolvedValue(res)
    expect(await insertWithAttachment(insert, { title: 'x' }, { ...OPTS, path: 'v/s/f.pdf' }))
      .toBe(res)
  })

  it('retries into the legacy URL column when the path column is missing', async () => {
    insert
      .mockResolvedValueOnce({ error: { code: 'PGRST204', message: "the 'file_path' column" } })
      .mockResolvedValueOnce({ data: { id: 'row-1' }, error: null })

    const res = await insertWithAttachment(insert, { title: 'x' }, { ...OPTS, path: 'v/s/f.pdf' })

    expect(insert).toHaveBeenLastCalledWith({ title: 'x', file_url: 'https://public/file.pdf' })
    expect(res.error).toBeNull()
  })

  // A dead link is still better than losing the row the file belongs to.
  it('writes the row even if no public URL can be built', async () => {
    getPublicUrl.mockReturnValueOnce({ data: null })
    insert
      .mockResolvedValueOnce({ error: { code: 'PGRST204', message: "the 'file_path' column" } })
      .mockResolvedValueOnce({ data: { id: 'row-1' }, error: null })

    await insertWithAttachment(insert, { title: 'x' }, { ...OPTS, path: 'v/s/f.pdf' })

    expect(insert).toHaveBeenLastCalledWith({ title: 'x', file_url: null })
  })
})
