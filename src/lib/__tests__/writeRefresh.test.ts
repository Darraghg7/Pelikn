import { describe, it, expect } from 'vitest'
import { shouldRefresh, tablesWritten, queryId } from '../writeRefresh'

const q = (...queryKey: unknown[]) => ({ queryKey })

describe('writeRefresh', () => {
  it('names widget queries by widget', () => {
    expect(queryId(['widget', 'open_actions', 'v1'])).toBe('widget:open_actions')
    expect(queryId(['managers', 'v1'])).toBe('managers')
  })

  it('refreshes a listed query only when a table it reads was written', () => {
    const written = tablesWritten(['cleaning_completions'])
    expect(shouldRefresh(q('widget', 'compliance_score', 'v1'), written)).toBe(false)
    expect(shouldRefresh(q('managers', 'v1'), written)).toBe(false)
    expect(shouldRefresh(q('widget', 'compliance_score', 'v1'), tablesWritten(['staff_training']))).toBe(true)
  })

  it('always refreshes a query nobody has listed', () => {
    expect(shouldRefresh(q('someNewScreen', 'v1'), tablesWritten(['cleaning_completions']))).toBe(true)
  })

  it('refreshes everything for an RPC it cannot place', () => {
    const written = tablesWritten(['rpc:record_clock_event'])
    expect(written).toBeNull()
    expect(shouldRefresh(q('managers', 'v1'), written)).toBe(true)
  })

  it('places a known RPC and merges it with table writes', () => {
    const written = tablesWritten(['rpc:complete_cleaning_task', 'corrective_actions'])
    expect(written).toEqual(new Set(['cleaning_completions', 'corrective_actions']))
    expect(shouldRefresh(q('widget', 'open_actions', 'v1'), written)).toBe(true)
    expect(shouldRefresh(q('widget', 'todays_deliveries', 'v1'), written)).toBe(false)
  })
})
