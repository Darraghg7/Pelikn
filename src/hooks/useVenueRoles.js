import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

// ── Venue roles (Barista, Chef, FOH…) ────────────────────────────────────────

export function useVenueRoles() {
  const { venueId } = useVenue()
  const [roles, setRoles]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase
      .from('venue_roles')
      .select('*')
      .eq('venue_id', venueId)
      .order('sort_order')
      .order('name')
    setRoles(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  const addRole = async (name) => {
    const { error } = await supabase.from('venue_roles').insert({
      venue_id:   venueId,
      name:       name.trim(),
      sort_order: roles.length,
    })
    if (!error) load()
    return { error }
  }

  const renameRole = async (id, name) => {
    const { error } = await supabase.from('venue_roles').update({ name: name.trim() }).eq('id', id)
    if (!error) load()
    return { error }
  }

  const deleteRole = async (id) => {
    // staff_role_assignments cascade-delete via FK
    // rota_requirements role_id set null via FK
    const { error } = await supabase.from('venue_roles').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  return { roles, loading, reload: load, addRole, renameRole, deleteRole }
}

// ── Staff ↔ roles assignment ──────────────────────────────────────────────────

export function useStaffRoleAssignments(staffId) {
  const [roleIds, setRoleIds] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!staffId) { setLoading(false); return }
    const { data } = await supabase
      .from('staff_role_assignments')
      .select('role_id')
      .eq('staff_id', staffId)
    setRoleIds((data ?? []).map(r => r.role_id))
    setLoading(false)
  }, [staffId])

  useEffect(() => { load() }, [load])

  const toggleRole = async (roleId) => {
    if (roleIds.includes(roleId)) {
      await supabase.from('staff_role_assignments')
        .delete().eq('staff_id', staffId).eq('role_id', roleId)
    } else {
      await supabase.from('staff_role_assignments')
        .insert({ staff_id: staffId, role_id: roleId })
    }
    load()
  }

  const setRoles = async (newRoleIds) => {
    // Replace all assignments for this staff member
    await supabase.from('staff_role_assignments').delete().eq('staff_id', staffId)
    if (newRoleIds.length > 0) {
      await supabase.from('staff_role_assignments').insert(
        newRoleIds.map(rid => ({ staff_id: staffId, role_id: rid }))
      )
    }
    load()
  }

  return { roleIds, loading, toggleRole, setRoles, reload: load }
}

// ── Bulk load: all assignments for a venue (for the edge function context) ───

export async function loadAllStaffRolesForVenue(venueId) {
  // Get all role IDs for this venue first
  const { data: venueRoles } = await supabase
    .from('venue_roles').select('id, name').eq('venue_id', venueId)
  if (!venueRoles?.length) return {}

  const roleMap = Object.fromEntries(venueRoles.map(r => [r.id, r.name]))
  const roleIds = venueRoles.map(r => r.id)

  const { data: assignments } = await supabase
    .from('staff_role_assignments').select('staff_id, role_id').in('role_id', roleIds)

  // Returns: { staffId: ['Barista', 'FOH', ...] }
  const result = {}
  for (const a of (assignments ?? [])) {
    if (!result[a.staff_id]) result[a.staff_id] = []
    result[a.staff_id].push(roleMap[a.role_id])
  }
  return result
}
