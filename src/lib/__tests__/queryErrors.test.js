import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReport } = vi.hoisted(() => ({ mockReport: vi.fn() }))
vi.mock('../reportError', () => ({ reportError: mockReport }))

import { throwIfError, reportQueryError } from '../queryErrors'

beforeEach(() => vi.clearAllMocks())

describe('throwIfError', () => {
  it('passes when no result has an error, including plain values', () => {
    expect(() => throwIfError({ data: [], error: null }, { count: 0 }, [1, 2], null, undefined)).not.toThrow()
  })

  it('throws the first error it finds', () => {
    const first = { message: 'first' }
    expect(() => throwIfError({ data: [] }, { data: null, error: first }, { data: null, error: { message: 'second' } }))
      .toThrow(expect.objectContaining({ message: 'first' }))
  })
})

describe('reportQueryError', () => {
  it('labels the report by the readable parts of the key, not the venue id', () => {
    const err = { message: 'boom' }
    const queryKey = ['widget', 'fridgeAlerts', '0b8c6a52-1d1f-4f7e-9a51-6f1d2b7c9e10', '2026-10-08']
    reportQueryError(err, { queryKey })
    expect(mockReport).toHaveBeenCalledWith(err, { context: 'query:widget/fridgeAlerts/2026-10-08', queryKey })
  })
})
