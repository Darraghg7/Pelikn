import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { readPersisted, writePersisted } from '../lib/persistedCache'

// ── Venue roles (Barista, Chef, FOH…) ────────────────────────────────────────

interface VenueRole {
  id: string
  name: string
  color?: string
  department_id?: string | null
  sort_order?: number
  venue_id: string
}

export function useVenueRoles(): {
  roles: VenueRole[]
  loading: boolean
  reload: () => void
  addRole: (name: string) => Promise<{ error: unknown }>
  renameRole: (id: string, name: string) => Promise<{ error: unknown }>
  deleteRole: (id: string) => Promise<{ error: unknown }>
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const { data: roles = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['venue_roles', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('venue_roles')
        .select('id, name, color, department_id, sort_order, venue_id')
        .eq('venue_id', venueId)
        .order('sort_order')
        .order('name')
      const roles = (data ?? []) as VenueRole[]
      writePersisted('venue_roles', venueId, roles)
      return roles
    },
    // Last-known roles render immediately on a cold open; fresh ones replace them.
    placeholderData: () => (readPersisted('venue_roles', venueId) as VenueRole[] | null) ?? undefined,
    enabled: !!venueId,
  })

  const addRole = async (name: string) => {
    const { error } = await supabase.from('venue_roles').insert({
      venue_id:   venueId,
      name:       name.trim(),
      sort_order: roles.length,
    })
    if (!error) queryClient.invalidateQueries({ queryKey: ['venue_roles', venueId] })
    return { error }
  }

  const renameRole = async (id: string, name: string) => {
    const { error } = await supabase.from('venue_roles').update({ name: name.trim() }).eq('id', id)
    if (!error) queryClient.invalidateQueries({ queryKey: ['venue_roles', venueId] })
    return { error }
  }

  const deleteRole = async (id: string) => {
    // staff_role_assignments cascade-delete via FK
    // rota_requirements role_id set null via FK
    const { error } = await supabase.from('venue_roles').delete().eq('id', id)
    if (!error) queryClient.invalidateQueries({ queryKey: ['venue_roles', venueId] })
    return { error }
  }

  return { roles, loading, reload: refetch, addRole, renameRole, deleteRole }
}

// ── Staff ↔ roles assignment ──────────────────────────────────────────────────

export function useStaffRoleAssignments(staffId: string): {
  roleIds: string[]
  loading: boolean
  toggleRole: (roleId: string) => Promise<{ error: unknown }>
  setRoles: (newRoleIds: string[]) => Promise<{ error: unknown }>
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const { data: roleIds = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['staff_role_assignments', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_role_assignments')
        .select('role_id')
        .eq('staff_id', staffId)
      return (data ?? []).map(r => (r as { role_id: string }).role_id)
    },
    enabled: !!staffId,
  })

  // venue_id is required: the live RLS policy on staff_role_assignments is
  // has_venue_access(venue_id) (091), so a row inserted without it is
  // rejected with 42501 and the role silently never saves.
  const toggleRole = async (roleId: string) => {
    const { error } = roleIds.includes(roleId)
      ? await supabase.from('staff_role_assignments')
          .delete().eq('staff_id', staffId).eq('role_id', roleId)
      : await supabase.from('staff_role_assignments')
          .insert({ staff_id: staffId, role_id: roleId, venue_id: venueId })
    queryClient.invalidateQueries({ queryKey: ['staff_role_assignments', staffId] })
    return { error }
  }

  const setRoles = async (newRoleIds: string[]) => {
    // Replace this venue's assignments for this staff member
    const { error: delErr } = await supabase.from('staff_role_assignments')
      .delete().eq('staff_id', staffId).eq('venue_id', venueId)
    if (delErr) return { error: delErr }
    let error: unknown = null
    if (newRoleIds.length > 0) {
      ;({ error } = await supabase.from('staff_role_assignments').insert(
        newRoleIds.map(rid => ({ staff_id: staffId, role_id: rid, venue_id: venueId }))
      ))
    }
    queryClient.invalidateQueries({ queryKey: ['staff_role_assignments', staffId] })
    return { error }
  }

  return { roleIds, loading, toggleRole, setRoles, reload: refetch }
}

// ── Bulk load: all assignments for a venue (for the edge function context) ───
//
// crossVenueStaffIds: IDs of staff linked from other venues (_crossVenue: true).
// Their role assignments live in their home venue's venue_roles rows — we fetch
// those separately so auto-fill can match them to requirements by role name.

export async function loadAllStaffRolesForVenue(
  venueId: string,
  crossVenueStaffIds: string[] = [],
): Promise<Record<string, string[]>> {
  // 1. Home-venue staff roles
  const { data: venueRoles } = await supabase
    .from('venue_roles').select('id, name').eq('venue_id', venueId)

  const roleMap: Record<string, string> = Object.fromEntries(
    (venueRoles ?? [] as { id: string; name: string }[]).map((r: { id: string; name: string }) => [r.id, r.name])
  )
  const roleIds = (venueRoles ?? [] as { id: string }[]).map((r: { id: string }) => r.id)

  const result: Record<string, string[]> = {}

  if (roleIds.length) {
    const { data: assignments } = await supabase
      .from('staff_role_assignments').select('staff_id, role_id').in('role_id', roleIds)
    for (const a of (assignments ?? []) as { staff_id: string; role_id: string }[]) {
      if (!result[a.staff_id]) result[a.staff_id] = []
      result[a.staff_id].push(roleMap[a.role_id])
    }
  }

  // 2. Cross-venue (linked) staff — load their home-venue role assignments
  if (crossVenueStaffIds.length) {
    const { data: crossAssignments } = await supabase
      .from('staff_role_assignments')
      .select('staff_id, role_id')
      .in('staff_id', crossVenueStaffIds)

    if ((crossAssignments ?? []).length) {
      const crossRoleIds = [...new Set((crossAssignments as { staff_id: string; role_id: string }[]).map(a => a.role_id))]
      const { data: crossRoles } = await supabase
        .from('venue_roles').select('id, name').in('id', crossRoleIds)
      const crossRoleMap: Record<string, string> = Object.fromEntries(
        (crossRoles ?? [] as { id: string; name: string }[]).map((r: { id: string; name: string }) => [r.id, r.name])
      )
      for (const a of (crossAssignments ?? []) as { staff_id: string; role_id: string }[]) {
        const roleName = crossRoleMap[a.role_id]
        if (!roleName) continue
        if (!result[a.staff_id]) result[a.staff_id] = []
        if (!result[a.staff_id].includes(roleName)) result[a.staff_id].push(roleName)
      }
    }
  }

  return result
}
