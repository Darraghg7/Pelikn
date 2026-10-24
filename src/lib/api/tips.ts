import { supabase } from '../supabase'

/**
 * Removes a tip split (its allocations go with it). Zero rows deleted is an
 * error, not a success: access rules can filter a delete to nothing without
 * saying so.
 */
export async function deleteSplitRow(splitId: string, venueId: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.from('tip_splits').delete().eq('id', splitId).eq('venue_id', venueId).select('id')
  if (error) return { error: new Error(error.message) }
  if (!data?.length) return { error: new Error('That tip split could not be deleted') }
  return { error: null }
}
