import { supabase } from '../supabase'

export interface Incident {
  id: string
  venue_id: string
  incident_date?: string | null
  reporter?: { id: string; name: string } | null
  [key: string]: unknown
}

export async function fetchIncidents(venueId: string): Promise<Incident[]> {
  const { data } = await supabase
    .from('incidents')
    .select('*, reporter:reported_by(id, name)')
    .eq('venue_id', venueId)
    .order('incident_date', { ascending: false })
  return (data ?? []) as unknown as Incident[]
}

export function insertIncident(payload: Record<string, unknown>) {
  return supabase.from('incidents').insert(payload)
}
