import { supabase } from '../supabase'
import { insertRow } from './writes'

type Row = Record<string, any>

/** Start a cooling batch (no end temperature yet). */
export function startCoolingBatch(row: Row): Promise<void> {
  return insertRow('cooling_logs', row)
}

/**
 * Finish a batch. Guarded on end_temp IS NULL so two devices can't both finish
 * the same one; returns false when another device already did.
 */
export async function finishCoolingBatch(
  venueId: string,
  batchId: string,
  values: { end_temp: number; finished_at: string; notes: string | null },
): Promise<boolean> {
  const { data, error } = await supabase
    .from('cooling_logs')
    .update(values)
    .eq('venue_id', venueId)
    .eq('id', batchId)
    .is('end_temp', null)
    .select('id')
  if (error) throw error
  return !!data?.length
}

/** Throw away a batch that is still cooling; a finished one is a record and can't be deleted. */
export async function discardCoolingBatch(venueId: string, batchId: string): Promise<void> {
  const { data, error } = await supabase
    .from('cooling_logs')
    .delete()
    .eq('venue_id', venueId)
    .eq('id', batchId)
    .is('end_temp', null)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('That batch was already finished or removed on another device')
}
