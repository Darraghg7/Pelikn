import { supabase } from '../supabase'

export interface Complaint {
  id: string
  venue_id: string
  date_received?: string | null
  [key: string]: unknown
}

export async function fetchComplaints(venueId: string): Promise<Complaint[]> {
  const { data } = await supabase
    .from('food_complaints')
    .select('*')
    .eq('venue_id', venueId)
    .order('date_received', { ascending: false })
    .limit(200)
  return (data ?? []) as unknown as Complaint[]
}

export function insertComplaint(payload: Record<string, unknown>) {
  return supabase.from('food_complaints').insert(payload)
}

export function updateComplaint(id: string, payload: Record<string, unknown>) {
  return supabase.from('food_complaints').update(payload).eq('id', id)
}
