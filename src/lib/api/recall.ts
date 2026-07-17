import { supabase } from '../supabase'

export interface RecallProcedure {
  id: string
  venue_id: string
  [key: string]: unknown
}

export interface RecallLog {
  id: string
  venue_id: string
  date_identified?: string | null
  [key: string]: unknown
}

export async function fetchRecallProcedure(venueId: string): Promise<RecallProcedure | null> {
  const { data } = await supabase
    .from('recall_procedures')
    .select('*')
    .eq('venue_id', venueId)
    .maybeSingle()
  return (data ?? null) as RecallProcedure | null
}

export async function fetchRecallLogs(venueId: string): Promise<RecallLog[]> {
  const { data } = await supabase
    .from('recall_logs')
    .select('*')
    .eq('venue_id', venueId)
    .order('date_identified', { ascending: false })
    .limit(200)
  return (data ?? []) as unknown as RecallLog[]
}

export function insertRecallLog(payload: Record<string, unknown>) {
  return supabase.from('recall_logs').insert(payload)
}

export function updateRecallLog(id: string, payload: Record<string, unknown>) {
  return supabase.from('recall_logs').update(payload).eq('id', id)
}

export function insertRecallProcedure(payload: Record<string, unknown>) {
  return supabase.from('recall_procedures').insert(payload)
}

export function updateRecallProcedure(venueId: string, payload: Record<string, unknown>) {
  return supabase.from('recall_procedures').update(payload).eq('venue_id', venueId)
}
