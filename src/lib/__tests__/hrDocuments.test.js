import { describe, it, expect, vi, beforeEach } from 'vitest'

const createSignedUrl = vi.fn()
vi.mock('../supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl }) } },
}))

const { hrAttachmentPath, hrAttachmentUrl, openHrAttachment, HR_SIGNED_URL_TTL_SECONDS } =
  await import('../hrDocuments')

describe('hrAttachmentPath', () => {
  it('namespaces uploads by venue then staff', () => {
    const p = hrAttachmentPath('venue-1', 'staff-2', 'contract.pdf')
    expect(p.startsWith('venue-1/staff-2/')).toBe(true)
  })

  // The storage policy reads the venue out of the first path segment, so a
  // filename must never be able to introduce segments of its own.
  it('cannot escape its venue/staff folder', () => {
    const p = hrAttachmentPath('venue-1', 'staff-2', 'my file (final)/../x.pdf')
    expect(p.split('/').length).toBe(3)
    expect(p.split('/')[0]).toBe('venue-1')
    expect(p.split('/')[2]).toMatch(/^\d+-my_file__final__\.\._x\.pdf$/)
  })
})

describe('hrAttachmentUrl', () => {
  beforeEach(() => createSignedUrl.mockReset())

  it('signs a short-lived link for a stored file', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    expect(await hrAttachmentUrl({ file_path: 'v/s/f.pdf' })).toBe('https://signed')
    expect(createSignedUrl).toHaveBeenCalledWith('v/s/f.pdf', HR_SIGNED_URL_TTL_SECONDS)
  })

  it('returns null rather than a broken link when signing fails', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error('nope') })
    expect(await hrAttachmentUrl({ file_path: 'v/s/f.pdf' })).toBeNull()
  })

  // Rows written before migration 085 hold a public URL and no path.
  it('falls back to a legacy public URL', async () => {
    expect(await hrAttachmentUrl({ file_url: 'https://legacy' })).toBe('https://legacy')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('prefers the signed path when a row has both', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    expect(await hrAttachmentUrl({ file_path: 'v/s/f.pdf', file_url: 'https://legacy' }))
      .toBe('https://signed')
  })

  it('returns null when there is no attachment', async () => {
    expect(await hrAttachmentUrl({})).toBeNull()
  })
})

describe('openHrAttachment', () => {
  beforeEach(() => {
    createSignedUrl.mockReset()
    vi.stubGlobal('open', vi.fn())
  })

  it('opens the signed link in a new tab', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    await openHrAttachment({ file_path: 'v/s/f.pdf' }, null)
    expect(window.open).toHaveBeenCalledWith('https://signed', '_blank', 'noopener,noreferrer')
  })

  it('tells the user when signing fails instead of opening nothing', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error('nope') })
    const toast = vi.fn()
    await openHrAttachment({ file_path: 'v/s/f.pdf' }, toast)
    expect(window.open).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/could not open/i), 'error')
  })

  it('reports a row with no attachment', async () => {
    const toast = vi.fn()
    await openHrAttachment({}, toast)
    expect(window.open).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/no file/i), 'error')
  })
})
