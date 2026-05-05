import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

// ── Venue roles (Barista, Chef, FOH…) ────────────────────────────────────────

interface VenueRole {
  id: string
  name: string
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
        .select('id, name, sort_order, venue_id')
        .eq('venue_id', venueId)
        .order('sort_order')
        .order('name')
      return (data ?? []) as VenueRole[]
    },
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
  toggleRole: (roleId: string) => Promise<void>
  setRoles: (newRoleIds: string[]) => Promise<void>
  reload: () => void
} {
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

  const toggleRole = async (roleId: string) => {
    if (roleIds.includes(roleId)) {
      await supabase.from('staff_role_assignments')
        .delete().eq('staff_id', staffId).eq('role_id', roleId)
    } else {
      await supabase.from('staff_role_assignments')
        .insert({ staff_id: staffId, role_id: roleId })
    }
    queryClient.invalidateQueries({ queryKey: ['staff_role_assignments', staffId] })
  }

  const setRoles = async (newRoleIds: string[]) => {
    // Replace all assignments for this staff member
    await supabase.from('staff_role_assignments').delete().eq('staff_id', staffId)
    if (newRoleIds.length > 0) {
      await supabase.from('staff_role_assignments').insert(
        newRoleIds.map(rid => ({ staff_id: staffId, role_id: rid }))
      )
    }
    queryClient.invalidateQueries({ queryKey: ['staff_role_assignments', staffId] })
  }

  return { roleIds, loading, toggleRole, setRoles, reload: refetch }
}

// ── Bulk load: all assignments for a venue (for the edge function context) ───

export async function loadAllStaffRolesForVenue(venueId: string): Promise<Record<string, string[]>> {
  // Get all role IDs for this venue first
  const { data: venueRoles } = await supabase
    .from('venue_roles').select('id, name').eq('venue_id', venueId)
  if (!venueRoles?.length) return {}

  const roleMap = Object.fromEntries((venueRoles as { id: string; name: string }[]).map(r => [r.id, r.name]))
  const roleIds = (venueRoles as { id: string }[]).map(r => r.id)

  const { data: assignments } = await supabase
    .from('staff_role_assignments').select('staff_id, role_id').in('role_id', roleIds)

  // Returns: { staffId: ['Barista', 'FOH', ...] }
  const result: Record<string, string[]> = {}
  for (const a of (assignments ?? []) as { staff_id: string; role_id: string }[]) {
    if (!result[a.staff_id]) result[a.staff_id] = []
    result[a.staff_id].push(roleMap[a.role_id])
  }
  return result
}
