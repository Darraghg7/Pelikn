import { describe, it, expect, vi, beforeEach } from 'vitest'

const createSignedUrl = vi.fn()
const from = vi.fn(() => ({ createSignedUrl }))
vi.mock('../supabase', () => ({ supabase: { storage: { from } } }))

const { VENUE_DOCS_BUCKET, venueDocumentPath, supplierCertPath, openVenueDocument, openSupplierCert, hasSupplierCert } =
  await import('../venueDocuments')

// The storage policy reads the venue from the first key segment, so every key
// must start with the venue and no filename may add segments of its own.
describe('paths', () => {
  it('files a document directly under its venue', () => {
    const p = venueDocumentPath('venue-1', 'licence.pdf')
    expect(p.split('/')).toHaveLength(2)
    expect(p.startsWith('venue-1/')).toBe(true)
    expect(p.endsWith('.pdf')).toBe(true)
  })

  it('does not let a document extension add path segments', () => {
    expect(venueDocumentPath('venue-1', 'x.pdf/../../other-venue').split('/')).toHaveLength(2)
  })

  it('files a supplier certificate under its venue', () => {
    expect(supplierCertPath('venue-1', 'cert.pdf').split('/').slice(0, 2)).toEqual(['venue-1', 'suppliers'])
  })

  it('does not let a certificate filename add path segments', () => {
    expect(supplierCertPath('venue-1', '../../etc/passwd').split('/')).toHaveLength(3)
  })
})

describe('opening', () => {
  let open
  beforeEach(() => {
    createSignedUrl.mockReset(); from.mockClear()
    open = vi.fn(); globalThis.window = { open }
  })

  it('signs the storage key rather than using the stored public URL', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    await openVenueDocument({ file_path: 'v/1.pdf', file_url: 'https://public' }, vi.fn())
    expect(from).toHaveBeenCalledWith(VENUE_DOCS_BUCKET)
    expect(open).toHaveBeenCalledWith('https://signed', '_blank', 'noopener,noreferrer')
  })

  it('reports a supplier certificate that could not be signed', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error('denied') })
    const toast = vi.fn()
    await openSupplierCert({ food_safety_cert_path: 'v/suppliers/c.pdf' }, toast)
    expect(open).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.any(String), 'error')
  })

  it('knows whether a supplier has a certificate by key or legacy URL', () => {
    expect(hasSupplierCert({ food_safety_cert_path: 'v/c' })).toBe(true)
    expect(hasSupplierCert({ food_safety_cert_url: 'https://x' })).toBe(true)
    expect(hasSupplierCert({})).toBe(false)
    expect(hasSupplierCert(null)).toBe(false)
  })
})
