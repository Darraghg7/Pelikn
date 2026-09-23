import { supabase } from '../supabase'

// The staff write RPCs live in migration 115. If the app is deployed before
// that migration is applied, PostgREST answers PGRST202 ("no function matches")
// and the raw message is unhelpful to whoever is standing in a kitchen trying
// to save a staff record. Rewrite it into something that names the cause.
//
// Deliberately NOT falling back to a direct table write here: that is exactly
// what 115 exists to replace, and it would fail silently again.
function explainMissingRpc<E extends { code?: string; message?: string } | null>(error: E): E {
  if (error?.code === 'PGRST202') {
    return {
      ...error,
      message: 'Staff changes need a database update that has not been applied yet (migration 115). Nothing was saved.',
    } as E
  }
  return error
}

// ── Reads (supplementary to useStaffManagement's own staff-list query) ───────

export async function fetchStaffVenueLinks(staffIds: string[]) {
  const { data, error } = await supabase.from('staff_venue_links').select('staff_id, venue_id').in('staff_id', staffIds)
  return { data: data ?? [], error }
}

export async function fetchStaffRoleAssignments(staffIds: string[]) {
  const { data, error } = await supabase.from('staff_role_assignments').select('staff_id, role_id').in('staff_id', staffIds)
  return { data, error }
}

export async function fetchStaffPermissionCounts(venueId: string, staffIds: string[]) {
  const { data } = await supabase.from('staff_permissions').select('staff_id, permission').eq('venue_id', venueId).in('staff_id', staffIds)
  return data ?? []
}

export async function fetchStaffPermissionsFor(staffId: string, venueId: string) {
  const { data } = await supabase.from('staff_permissions').select('permission').eq('staff_id', staffId).eq('venue_id', venueId)
  return data ?? []
}

// ── Photo upload ─────────────────────────────────────────────────────────────

export function uploadStaffPhotoFile(path: string, file: File) {
  return supabase.storage.from('staff-photos').upload(path, file, { upsert: true })
}
export function getStaffPhotoPublicUrl(path: string) {
  return supabase.storage.from('staff-photos').getPublicUrl(path)
}
export function updateStaffPhotoUrl(sessionToken: string, staffId: string, photoUrl: string) {
  return updateStaffFields(sessionToken, staffId, { photo_url: photoUrl })
}

// ── Venue link toggle (explicit named RPCs, not a dynamic string) ────────────

export function linkStaffToVenue(sessionToken: string, staffId: string, targetVenueId: string) {
  return supabase.rpc('link_staff_to_venue', { p_session_token: sessionToken, p_staff_id: staffId, p_target_venue_id: targetVenueId })
}
export function unlinkStaffFromVenue(sessionToken: string, staffId: string, targetVenueId: string) {
  return supabase.rpc('unlink_staff_from_venue', { p_session_token: sessionToken, p_staff_id: staffId, p_target_venue_id: targetVenueId })
}

// ── Create / update staff member ──────────────────────────────────────────────

export function createStaffMemberRpc(params: Record<string, unknown>) {
  return supabase.rpc('create_staff_member', params)
}
export function updateStaffMemberRpc(params: Record<string, unknown>) {
  return supabase.rpc('update_staff_member', params)
}
// Was `supabase.from('staff').update(fields)`. That has been a no-op since 091
// removed every write policy on `staff` — a blocked UPDATE matches zero rows
// and PostgREST reports 204, so the UI said "Staff member updated" while
// nothing changed. Goes through the 115 RPC now, which raises if it matches
// no row. See supabase/migrations/115_staff_write_rpcs.sql.
export async function updateStaffFields(
  sessionToken: string,
  staffId: string,
  fields: Record<string, unknown>,
) {
  const res = await supabase.rpc('update_staff_fields', {
    p_session_token: sessionToken,
    p_staff_id:      staffId,
    p_fields:        fields,
  })
  return { ...res, error: explainMissingRpc(res.error) }
}
export async function findNewestStaffByName(venueId: string, name: string) {
  const { data } = await supabase.from('staff').select('id').eq('venue_id', venueId).eq('name', name).order('created_at', { ascending: false }).limit(1)
  return data?.[0]?.id as string | undefined
}

export function updateStaffContractType(sessionToken: string, staffId: string, employmentType: string, contractedHours: number | null) {
  return updateStaffFields(sessionToken, staffId, {
    employment_type:  employmentType,
    contracted_hours: contractedHours ?? null,
  })
}

// ── Activate / deactivate / delete (explicit named RPCs, not a dynamic string) ─

export function deactivateStaffMemberRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('deactivate_staff_member', { p_session_token: sessionToken, p_staff_id: staffId })
}
export function reactivateStaffMemberRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('reactivate_staff_member', { p_session_token: sessionToken, p_staff_id: staffId })
}
export function restrictStaffMemberRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('restrict_staff_member', { p_session_token: sessionToken, p_staff_id: staffId })
}
export function unrestrictStaffMemberRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('unrestrict_staff_member', { p_session_token: sessionToken, p_staff_id: staffId })
}
// Same no-op problem as the updates, with worse consequences: the UI reported
// "<name> permanently deleted" on a DELETE that RLS had filtered to zero rows,
// so an erasure request could be recorded as honoured without being honoured.
export async function deleteStaffMember(sessionToken: string, staffId: string) {
  const res = await supabase.rpc('delete_staff_member', {
    p_session_token: sessionToken,
    p_staff_id:      staffId,
  })
  return { ...res, error: explainMissingRpc(res.error) }
}

// Replaces updateStaffSortOrder, which the caller invoked once per row on
// every move. One call for the whole ordering instead of N.
export async function reorderVenueStaff(sessionToken: string, staffIds: string[]) {
  const res = await supabase.rpc('reorder_venue_staff', {
    p_session_token: sessionToken,
    p_staff_ids:     staffIds,
  })
  return { ...res, error: explainMissingRpc(res.error) }
}
export function resetStaffPinLockRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('reset_staff_pin_lock', { p_session_token: sessionToken, p_staff_id: staffId })
}
