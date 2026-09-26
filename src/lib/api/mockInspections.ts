import { supabase } from '../supabase'

export interface MockInspection {
  id: string
  venue_id: string
  completed_by: string | null
  completed_by_name: string | null
  answers: Record<string, 'yes' | 'partial' | 'no' | 'na'>
  score: number
  created_at: string
}

/** Thrown when mock_inspections doesn't exist yet — migration 131 not applied. */
export class MockInspectionsUnavailable extends Error {
  constructor() {
    super('Saving mock inspections needs database migration 131 (mock_inspections) to be applied.')
  }
}

// PGRST205 = table not in the schema cache, 42P01 = relation does not exist.
// Named loudly instead of rendering an empty history that looks like real data.
function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === 'PGRST205' || error.code === '42P01')
}

export async function fetchMockInspections(venueId: string): Promise<MockInspection[]> {
  const { data, error } = await supabase
    .from('mock_inspections')
    .select('id, venue_id, completed_by, completed_by_name, answers, score, created_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(24)
  if (isMissingTable(error)) throw new MockInspectionsUnavailable()
  if (error) throw new Error(error.message)
  return (data ?? []) as MockInspection[]
}

export async function insertMockInspection(row: {
  venue_id: string
  completed_by: string | null
  completed_by_name: string | null
  answers: MockInspection['answers']
  score: number
}): Promise<MockInspection> {
  const { data, error } = await supabase.from('mock_inspections').insert(row).select().single()
  if (isMissingTable(error)) throw new MockInspectionsUnavailable()
  if (error) throw new Error(error.message)
  return data as MockInspection
}
