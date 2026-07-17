import { format, subDays } from 'date-fns'
import { supabase } from '../supabase'

export interface DateLabellingLog {
  id: string
  venue_id: string
  opened_date?: string | null
  item_name?: string | null
  [key: string]: unknown
}

/** Recent date-labelling logs (last 7 days), newest opened_date first. */
export async function fetchDateLabellingLogs(venueId: string): Promise<DateLabellingLog[]> {
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('date_labelling_logs')
    .select('*')
    .eq('venue_id', venueId)
    .gte('opened_date', weekAgo)
    .order('opened_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DateLabellingLog[]
}

/** Logs across an explicit date range, for PDF export. */
export function fetchDateLabellingExport(venueId: string, from: string, to: string) {
  return supabase
    .from('date_labelling_logs')
    .select('opened_date, item_name, use_by_date, storage_location, recorded_by_name, notes')
    .eq('venue_id', venueId)
    .gte('opened_date', from)
    .lte('opened_date', to)
    .order('opened_date')
}

export function insertDateLabellingLog(payload: Record<string, unknown>) {
  return supabase.from('date_labelling_logs').insert(payload)
}
