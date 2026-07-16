import { useCallback, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

const PERMISSIONS_UPDATED_EVENT = 'pelikn:permissions-updated'

async function fetchPermissions(staffId: string, venueId: string): Promise<string[]> {
  const { data } = await supabase
    .from('staff_permissions')
    .select('permission')
    .eq('staff_id', staffId)
    .eq('venue_id', venueId)

  return (data ?? []).map((r: { permission: string }) => r.permission)
}

/**
 * Fetches granular permissions for a staff member from the staff_permissions table.
 * Managers/owners short-circuit to all permissions granted.
 */
export function useStaffPermissions(staffId: string, staffRole: string): {
  permissions: Set<string>
  hasPermission: (permissionId: string) => boolean
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const isManager = staffRole === 'manager' || staffRole === 'owner'

  const queryKey = ['staff-permissions', staffId, venueId]

  const { data: permissionsList, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchPermissions(staffId, venueId!),
    enabled: !isManager && !!staffId && !!venueId,
    placeholderData: [],
    staleTime: 60_000,
  })

  const loading = isManager ? false : isLoading

  const permissions = useMemo(() => {
    if (isManager) return new Set(['__all__'])
    return new Set(permissionsList ?? [])
  }, [isManager, permissionsList])

  // Listen for updates from staff edit form
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ staffId: string; venueId: string }>).detail
      if (detail?.staffId === staffId && detail?.venueId === venueId) {
        refetch()
      }
    }
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, handler)
    return () => window.removeEventListener(PERMISSIONS_UPDATED_EVENT, handler)
  }, [staffId, venueId, refetch])

  const hasPermission = useCallback((permissionId: string): boolean => {
    if (isManager) return true
    return permissions.has(permissionId)
  }, [permissions, isManager])

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return { permissions, hasPermission, loading, reload }
}

/**
 * Save permissions for a staff member — replaces all existing permissions.
 * Goes through the save_staff_permissions SECURITY DEFINER RPC so the anon
 * role never writes directly to staff_permissions.
 * Dispatches an event so other hook instances refresh.
 */
export async function saveStaffPermissions(staffId: string, venueId: string, permissionIds: string[], sessionToken: string): Promise<void> {
  await supabase.rpc('save_staff_permissions', {
    p_session_token: sessionToken,
    p_staff_id:      staffId,
    p_permissions:   permissionIds,
  })

  // Notify other instances
  window.dispatchEvent(new CustomEvent(PERMISSIONS_UPDATED_EVENT, { detail: { staffId, venueId } }))
}
