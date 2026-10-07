import { describe, it, expect } from 'vitest'
import { staffListState, venueLookupFailure } from '../loginScreenState'

describe('staffListState', () => {
  it('shows the loading state while the first fetch is in flight', () => {
    expect(staffListState({ loading: true, failed: false, staff: [] })).toBe('loading')
  })

  it('shows the list once names have arrived', () => {
    expect(staffListState({ loading: false, failed: false, staff: [{ id: 1 }] })).toBe('ready')
  })

  it('keeps showing cached names while a refresh runs', () => {
    expect(staffListState({ loading: true, failed: false, staff: [{ id: 1 }] })).toBe('ready')
  })

  it('keeps showing cached names when the refresh fails (offline)', () => {
    expect(staffListState({ loading: false, failed: true, staff: [{ id: 1 }] })).toBe('ready')
  })

  it('shows the error state when the fetch failed and nothing is cached', () => {
    expect(staffListState({ loading: false, failed: true, staff: [] })).toBe('error')
  })

  it('shows the empty state only when the server answered with no staff', () => {
    expect(staffListState({ loading: false, failed: false, staff: [] })).toBe('empty')
  })

  it('treats a missing list as empty rather than crashing', () => {
    expect(staffListState({ loading: false, failed: false, staff: null })).toBe('empty')
  })
})

describe('venueLookupFailure', () => {
  it('reports not-found only for PostgREST "no rows"', () => {
    expect(venueLookupFailure({ code: 'PGRST116' })).toBe('not-found')
  })

  it('reports a connection problem for anything else', () => {
    expect(venueLookupFailure({ message: 'TypeError: Failed to fetch', code: '' })).toBe('error')
    expect(venueLookupFailure(null)).toBe('error')
  })
})
