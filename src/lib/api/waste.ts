import { supabase } from '../supabase'
import { insertRow } from './writes'

export function insertWasteLog(row: Record<string, any>): Promise<void> {
  return insertRow('waste_logs', row)
}

/** Rows for the PDF export, oldest first. Dates are 'yyyy-MM-dd'. */
export async function fetchWasteForExport(venueId: string, dateFrom: string, dateTo: string): Promise<Record<string, any>[]> {
  const { data, error } = await supabase
    .from('waste_logs')
    .select('recorded_at, item_name, quantity, unit, reason, recorded_by_name, notes')
    .eq('venue_id', venueId)
    .gte('recorded_at', dateFrom)
    .lte('recorded_at', dateTo + 'T23:59:59')
    .order('recorded_at')
  if (error) throw error
  return data ?? []
}
