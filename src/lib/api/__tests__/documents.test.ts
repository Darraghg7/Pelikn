import { describe, it, expect, vi, beforeEach } from 'vitest'

const upload = vi.fn()
const insert = vi.fn()
const calls: Array<{ table: string; method: string; args: unknown[] }> = []
let listResult: { data: unknown; error: unknown } = { data: [], error: null }

vi.mock('../../supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a), getPublicUrl: () => ({ data: { publicUrl: 'pub' } }) }) },
    from: (table: string) => {
      const b: any = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') return (r: (v: unknown) => void) => r(listResult)
          if (prop === 'insert') return (row: unknown) => insert(row)
          return (...args: unknown[]) => { calls.push({ table, method: prop, args }); return b }
        },
      })
      return b
    },
  },
}))

import { fetchDocuments, uploadVenueDocument } from '../documents'

const file = new File(['x'], 'licence.pdf', { type: 'application/pdf' })
const fields = { title: ' Licence ', category: 'licences', expiryDate: '', notes: '', uploadedBy: 's1' }

beforeEach(() => { upload.mockReset(); insert.mockReset(); calls.length = 0; listResult = { data: [], error: null } })

describe('documents', () => {
  it('lists the venue\'s documents and throws on error', async () => {
    await fetchDocuments('v-1')
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'venue_id' && c.args[1] === 'v-1')).toBe(true)
    listResult = { data: null, error: new Error('x') }
    await expect(fetchDocuments('v-1')).rejects.toThrow('x')
  })

  it('uploads into the venue folder and records the storage key, not a public URL', async () => {
    upload.mockResolvedValue({ error: null })
    insert.mockResolvedValue({ error: null })
    await uploadVenueDocument('v-1', file, fields)
    expect((upload.mock.calls[0][0] as string).startsWith('v-1/')).toBe(true)
    const row = insert.mock.calls[0][0]
    expect(row).toMatchObject({ venue_id: 'v-1', title: 'Licence', file_name: 'licence.pdf', uploaded_by: 's1', expiry_date: null })
    expect(row.file_path).toBe(upload.mock.calls[0][0])
    expect(row.file_url).toBeUndefined()
  })

  it('stops before recording anything when the upload fails', async () => {
    upload.mockResolvedValue({ error: new Error('too big') })
    await expect(uploadVenueDocument('v-1', file, fields)).rejects.toThrow('File upload failed: too big')
    expect(insert).not.toHaveBeenCalled()
  })

  it('surfaces a failed insert', async () => {
    upload.mockResolvedValue({ error: null })
    insert.mockResolvedValue({ error: new Error('rls') })
    await expect(uploadVenueDocument('v-1', file, fields)).rejects.toThrow('rls')
  })
})
