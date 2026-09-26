import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../contexts/VenueContext', () => ({ useVenue: () => ({ venueId: 'venue-1' }) }))
vi.mock('../../lib/persistedCache', () => ({ readPersisted: () => null, writePersisted: () => {} }))

const { useTasksForStaff } = await import('../useTasks')

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

const TEMPLATES = [
  { id: 't-k', title: 'Degrease fryer', department_id: 'kitchen' },
  { id: 't-f', title: 'Wipe tables',    department_id: 'foh' },
  { id: 't-all', title: 'Take bins out', department_id: null },
]
const ONE_OFFS = [
  { id: 'o-me',    title: 'Call supplier',  department_id: null, assigned_to_staff_id: 'me',    due_date: '2026-09-26' },
  { id: 'o-other', title: 'Sign contract',  department_id: null, assigned_to_staff_id: 'other', due_date: '2026-09-26' },
  { id: 'o-k',     title: 'Deep clean hob', department_id: 'kitchen', due_date: '2026-09-26' },
]

describe('useTasksForStaff', () => {
  let client
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    global.fetch = vi.fn(async (url) => {
      const u = typeof url === 'string' ? url : url?.url ?? ''
      if (u.includes('/rest/v1/task_templates')) return json(TEMPLATES)
      if (u.includes('/rest/v1/task_one_offs')) return json(ONE_OFFS)
      return json([])
    })
  })
  afterEach(() => { client.clear(); vi.restoreAllMocks() })

  const ids = (r) => [...r.templates, ...r.oneOffs].map(t => t.id).sort()

  it('shows my departments, Everyone items and tasks assigned to me by name', async () => {
    const h = renderHook(() => useTasksForStaff(['foh'], 'me', ['kitchen', 'foh']), { wrapper })
    await waitFor(() => expect(h.result.current.loading).toBe(false))
    expect(ids(h.result.current)).toEqual(['o-me', 't-all', 't-f'])
  })

  it("never shows a task assigned to someone else, even to a person in no department", async () => {
    const h = renderHook(() => useTasksForStaff([], 'me', ['kitchen', 'foh']), { wrapper })
    await waitFor(() => expect(h.result.current.loading).toBe(false))
    expect(ids(h.result.current)).toEqual(['o-k', 'o-me', 't-all', 't-f', 't-k'])
  })
})
