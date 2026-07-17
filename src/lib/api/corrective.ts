import { supabase } from '../supabase'

export interface CorrectiveAction {
  id: string
  venue_id: string
  reported_at?: string | null
  reporter?: { name: string } | null
  resolver?: { name: string } | null
  [key: string]: unknown
}

export async function fetchCorrectiveActions(venueId: string): Promise<CorrectiveAction[]> {
  const { data } = await supabase
    .from('corrective_actions')
    .select('*, reporter:staff!reported_by(name), resolver:staff!resolved_by(name)')
    .eq('venue_id', venueId)
    .order('reported_at', { ascending: false })
    .limit(200)
  return (data ?? []) as unknown as CorrectiveAction[]
}

export function insertCorrectiveAction(payload: Record<string, unknown>) {
  return supabase.from('corrective_actions').insert(payload)
}

export function updateCorrectiveAction(id: string, payload: Record<string, unknown>) {
  return supabase.from('corrective_actions').update(payload).eq('id', id)
}
