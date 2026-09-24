import { supabase } from '../supabase'

export interface Incident {
  id: string
  venue_id: string
  incident_date?: string | null
  reporter?: { id: string; name: string } | null
  [key: string]: unknown
}

// Columns added by migration 122. Before it's applied, writes drop them.
const COLUMNS_122 = [
  'title', 'incident_type', 'riddor', 'riddor_category', 'riddor_reported_at',
  'riddor_reference', 'status', 'closed_at', 'closed_by', 'closure_note',
]

function isMissingColumn(error: { message?: string; code?: string } | null): boolean {
  return !!error && (error.code === 'PGRST204' || /column/i.test(error.message ?? ''))
}

export async function fetchIncidents(venueId: string): Promise<Incident[]> {
  const { data } = await supabase
    .from('incidents')
    .select('*, reporter:reported_by(id, name)')
    .eq('venue_id', venueId)
    .order('incident_date', { ascending: false })
  return (data ?? []) as unknown as Incident[]
}

/**
 * Insert an incident. Before migration 122 the new columns don't exist, so the
 * report is saved without them: the title is folded into the description and a
 * RIDDOR flag is kept the old way, as severity 'riddor'.
 */
export async function insertIncident(payload: Record<string, unknown>) {
  const result = await supabase.from('incidents').insert(payload)
  if (!isMissingColumn(result.error)) return result

  const legacy = Object.fromEntries(Object.entries(payload).filter(([key]) => !COLUMNS_122.includes(key)))
  if (payload.title) legacy.description = `${payload.title}. ${payload.description}`
  if (payload.riddor) legacy.severity = 'riddor'
  return supabase.from('incidents').insert(legacy)
}

export function updateIncident(id: string, changes: Record<string, unknown>) {
  return supabase.from('incidents').update(changes).eq('id', id)
}
