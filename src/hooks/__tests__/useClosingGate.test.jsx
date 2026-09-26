import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'venue-1' }) }))
vi.mock('../../lib/api/bootstrap', () => ({ takeBootstrap: async () => null }))

const { useClosingGate, EVERYONE } = await import('../useClosingGate')

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

const CHECKS = [
  { id: 'k1', department_id: 'kitchen' },
  { id: 'f1', department_id: 'foh' },
  { id: 'e1', department_id: null },
]
const DEPARTMENTS = [{ id: 'kitchen', name: 'Kitchen' }, { id: 'foh', name: 'Front of house' }]

describe('useClosingGate', () => {
  let client, myDepartments, completions
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    myDepartments = []
    completions = []
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/shifts')) return json([{ is_closing: true }])
      if (u.includes('/rest/v1/opening_closing_checks')) return json(CHECKS)
      if (u.includes('/rest/v1/staff_departments')) return json(myDepartments.map(id => ({ department_id: id })))
      if (u.includes('/rest/v1/departments')) return json(DEPARTMENTS)
      if (u.includes('/rest/v1/opening_closing_completions')) return json(completions)
      return json([])
    })
  })
  afterEach(() => { client.clear(); vi.restoreAllMocks() })

  const groups = async () => {
    const h = renderHook(() => useClosingGate('me'), { wrapper })
    await waitFor(() => expect(h.result.current.loading).toBe(false))
    return h.result.current
  }

  it('a Kitchen closer answers for Kitchen and Everyone checks, not Front of house', async () => {
    myDepartments = ['kitchen']
    const gate = await groups()
    expect(gate.departments.map(d => d.departmentId)).toEqual(['kitchen', EVERYONE])
    expect(gate.departments.map(d => d.departmentName)).toEqual(['Kitchen', 'Everyone'])
    expect(gate.blocked).toBe(true)
  })

  it('a closer in no department answers for every department', async () => {
    const gate = await groups()
    expect(gate.departments.map(d => d.departmentId)).toEqual(['foh', 'kitchen', EVERYONE])
  })

  it('is clear once every check is done and they ticked some themselves', async () => {
    myDepartments = ['kitchen']
    completions = [{ check_id: 'k1', staff_id: 'me' }, { check_id: 'e1', staff_id: 'me' }]
    const gate = await groups()
    expect(gate.blocked).toBe(false)
  })
})
