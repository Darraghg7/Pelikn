import { supabase } from '../supabase'
import { insertRow } from './writes'

export async function fetchProbeCalibrations(venueId: string): Promise<Record<string, any>[]> {
  const { data, error } = await supabase
    .from('probe_calibrations')
    .select('*, calibrator:staff!calibrated_by(name)')
    .eq('venue_id', venueId)
    .order('calibrated_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export function insertProbeCalibration(row: Record<string, any>): Promise<void> {
  return insertRow('probe_calibrations', row)
}
