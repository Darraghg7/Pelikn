import { describe, it, expect, vi, beforeEach } from 'vitest'

const createSignedUrl = vi.fn()
const from = vi.fn(() => ({ createSignedUrl }))
vi.mock('../supabase', () => ({ supabase: { storage: { from } } }))

const { TRAINING_BUCKET, trainingFilePath, deliveryPhotoPath, trainingFileUrl, openTrainingFile } =
  await import('../trainingFiles')

describe('paths', () => {
  it('files a certificate under its venue then staff member', () => {
    const p = trainingFilePath('venue-1', 'staff-2', 'level2.pdf')
    expect(p.split('/').slice(0, 2)).toEqual(['venue-1', 'staff-2'])
  })

  // Delivery photos have no owning staff member but must still sit under the
  // venue, because the storage policy reads the venue from the first segment.
  it('files a delivery photo under its venue', () => {
    const p = deliveryPhotoPath('venue-1', 'crate.jpg')
    expect(p.split('/').slice(0, 2)).toEqual(['venue-1', 'delivery-photos'])
  })

  it('does not let a filename add path segments', () => {
    expect(deliveryPhotoPath('venue-1', '../../etc/passwd').split('/').length).toBe(3)
  })
})

describe('trainingFileUrl', () => {
  beforeEach(() => { createSignedUrl.mockReset(); from.mockClear() })

  it('signs against the training bucket', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    expect(await trainingFileUrl({ file_path: 'v/s/f.pdf' })).toBe('https://signed')
    expect(from).toHaveBeenCalledWith(TRAINING_BUCKET)
  })

  // 086 backfills file_path for every existing row, so this only covers rows
  // written between that migration and this code going live.
  it('falls back to a legacy public URL', async () => {
    expect(await trainingFileUrl({ file_url: 'https://legacy' })).toBe('https://legacy')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns null when signing fails rather than a dead link', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error('denied') })
    expect(await trainingFileUrl({ file_path: 'v/s/f.pdf' })).toBeNull()
  })
})

describe('openTrainingFile', () => {
  beforeEach(() => {
    createSignedUrl.mockReset()
    vi.stubGlobal('open', vi.fn())
  })

  it('opens the signed link', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    await openTrainingFile({ file_path: 'v/s/f.pdf' }, null)
    expect(window.open).toHaveBeenCalledWith('https://signed', '_blank', 'noopener,noreferrer')
  })

  it('reports a failure instead of opening nothing', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error('denied') })
    const toast = vi.fn()
    await openTrainingFile({ file_path: 'v/s/f.pdf' }, toast)
    expect(window.open).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/could not open/i), 'error')
  })
})
