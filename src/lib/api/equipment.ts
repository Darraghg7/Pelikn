import { format, subDays } from 'date-fns'
import { supabase } from '../supabase'

export interface EquipmentLog {
  id: string
  venue_id: string
  service_date?: string | null
  equipment_name?: string | null
  [key: string]: unknown
}

/** Recent equipment-maintenance logs (last 90 days), newest service_date first. */
export async function fetchEquipmentLogs(venueId: string): Promise<EquipmentLog[]> {
  const from = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('equipment_maintenance_logs')
    .select('*')
    .eq('venue_id', venueId)
    .gte('service_date', from)
    .order('service_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EquipmentLog[]
}

/** Logs across an explicit date range, for PDF export. */
export function fetchEquipmentExport(venueId: string, from: string, to: string) {
  return supabase
    .from('equipment_maintenance_logs')
    .select('service_date, equipment_name, service_type, next_due_date, engineer_name, recorded_by_name, notes')
    .eq('venue_id', venueId)
    .gte('service_date', from)
    .lte('service_date', to)
    .order('service_date')
}

export function insertEquipmentLog(payload: Record<string, unknown>) {
  return supabase.from('equipment_maintenance_logs').insert(payload)
}
