/**
 * Staff leaving (migration 152). Managers and owners only — the database
 * refuses everyone else, and plain staff read no rows at all.
 *
 * Writes that matter go through RPCs because they do more than one thing:
 *   mark_staff_leaving    records the last day and clears rota shifts after it
 *   finish_staff_leaving  deactivates, signs out every device, clears the rota
 *                         and cancels time off after the last day
 * Ticking the checklist and cancelling are plain table writes; both ask for
 * the row back, because a write RLS filters to zero rows still "succeeds".
 */
import { supabase } from '../supabase'
import { fetchAllPages } from './holidayData'

// PGRST205 table not found / PGRST202 function not found (152 not applied yet); 42P01 undefined table.
export const isLeavingMissing = (e) => !!e && ['PGRST205', 'PGRST202', '42P01'].includes(e.code)

const MISSING_MESSAGE = 'Staff leaving needs a database update (152) before it can be used'

function friendly(error) {
  if (!error) return null
  return isLeavingMissing(error) ? { ...error, message: MISSING_MESSAGE } : error
}

/** Leaving rows for the venue. Before 152 there is no table: none, flagged. */
export async function fetchVenueLeavers(venueId) {
  try {
    const rows = await fetchAllPages(() => supabase
      .from('staff_leaving')
      .select('staff_id, venue_id, last_day, reason, note, checklist, finished_at, created_at')
      .eq('venue_id', venueId)
      .order('last_day', { ascending: true })
      .order('staff_id', { ascending: true }))
    return { rows, missing: false }
  } catch (e) {
    if (isLeavingMissing(e)) return { rows: [], missing: true }
    throw e
  }
}

/** @returns {Promise<{ removedShifts: number, error: any }>} */
export async function markStaffLeaving({ staffId, lastDay, reason, note }) {
  const { data, error } = await supabase.rpc('mark_staff_leaving', {
    p_staff_id: staffId,
    p_last_day: lastDay,
    p_reason: reason || null,
    p_note: note?.trim() || null,
  })
  return { removedShifts: Number(data) || 0, error: friendly(error) }
}

export async function finishStaffLeaving(staffId) {
  const { error } = await supabase.rpc('finish_staff_leaving', { p_staff_id: staffId })
  return { error: friendly(error) }
}

export async function updateLeavingChecklist(staffId, checklist) {
  const { data, error } = await supabase
    .from('staff_leaving')
    .update({ checklist })
    .eq('staff_id', staffId)
    .select('staff_id')
  if (error) return { error: friendly(error) }
  if (!data?.length) return { error: { message: 'Only a manager can do that' } }
  return { error: null }
}

export async function cancelStaffLeaving(staffId) {
  const { data, error } = await supabase
    .from('staff_leaving')
    .delete()
    .eq('staff_id', staffId)
    .select('staff_id')
  if (error) return { error: friendly(error) }
  if (!data?.length) return { error: { message: 'They have already left, so this can no longer be cancelled' } }
  return { error: null }
}

/** A full year's days allowance set by a manager, or null. */
export async function fetchEntitlementOverride(staffId, year) {
  const { data, error } = await supabase
    .from('leave_entitlements')
    .select('override_days')
    .eq('staff_id', staffId)
    .eq('leave_year', year)
    .maybeSingle()
  if (error) throw error
  return data?.override_days ?? null
}
