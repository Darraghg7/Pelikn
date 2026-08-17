import { supabase } from '../supabase'

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
export function updateStaffPhotoUrl(staffId: string, photoUrl: string) {
  return supabase.from('staff').update({ photo_url: photoUrl }).eq('id', staffId)
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
export function updateStaffExtraFields(staffId: string, fields: Record<string, unknown>) {
  return supabase.from('staff').update(fields).eq('id', staffId)
}
export async function findNewestStaffByName(venueId: string, name: string) {
  const { data } = await supabase.from('staff').select('id').eq('venue_id', venueId).eq('name', name).order('created_at', { ascending: false }).limit(1)
  return data?.[0]?.id as string | undefined
}

export function updateStaffContractType(staffId: string, employmentType: string, contractedHours: number | null) {
  return supabase.from('staff').update({ employment_type: employmentType, contracted_hours: contractedHours ?? null }).eq('id', staffId)
}

// ── Activate / deactivate / delete (explicit named RPCs, not a dynamic string) ─

export function deactivateStaffMemberRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('deactivate_staff_member', { p_session_token: sessionToken, p_staff_id: staffId })
}
export function reactivateStaffMemberRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('reactivate_staff_member', { p_session_token: sessionToken, p_staff_id: staffId })
}
export function deleteStaffRow(staffId: string) {
  return supabase.from('staff').delete().eq('id', staffId)
}
export function updateStaffSortOrder(staffId: string, sortOrder: number) {
  return supabase.from('staff').update({ sort_order: sortOrder }).eq('id', staffId)
}
export function resetStaffPinLockRpc(sessionToken: string, staffId: string) {
  return supabase.rpc('reset_staff_pin_lock', { p_session_token: sessionToken, p_staff_id: staffId })
}
