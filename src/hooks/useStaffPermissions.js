import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

const PERMISSIONS_UPDATED_EVENT = 'safeserv:permissions-updated'

// Module-level cache per staffId:venueId
const _cache = {}

/**
 * Fetches granular permissions for a staff member from the staff_permissions table.
 * Managers/owners short-circuit to all permissions granted.
 */
export function useStaffPermissions(staffId, staffRole) {
  const { venueId } = useVenue()
  const isManager = staffRole === 'manager' || staffRole === 'owner'

  const [permissions, setPermissions] = useState(() => {
    if (isManager) return new Set(['__all__'])
    const key = `${staffId}:${venueId}`
    return _cache[key] ? new Set(_cache[key]) : new Set()
  })
  const [loading, setLoading] = useState(!isManager)

  const load = useCallback(async () => {
    if (isManager || !staffId || !venueId) { setLoading(false); return }

    const key = `${staffId}:${venueId}`
    if (_cache[key + '_ts'] && Date.now() - _cache[key + '_ts'] < 60000) {
      setPermissions(new Set(_cache[key]))
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('staff_permissions')
      .select('permission')
      .eq('staff_id', staffId)
      .eq('venue_id', venueId)

    const perms = (data ?? []).map(r => r.permission)
    _cache[key] = perms
    _cache[key + '_ts'] = Date.now()
    setPermissions(new Set(perms))
    setLoading(false)
  }, [staffId, venueId, isManager])

  useEffect(() => { load() }, [load])

  // Listen for updates from staff edit form
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.staffId === staffId && e.detail?.venueId === venueId) {
        // Bust cache and reload
        const key = `${staffId}:${venueId}`
        delete _cache[key]
        delete _cache[key + '_ts']
        load()
      }
    }
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, handler)
    return () => window.removeEventListener(PERMISSIONS_UPDATED_EVENT, handler)
  }, [staffId, venueId, load])

  const hasPermission = useCallback((permissionId) => {
    if (isManager) return true
    return permissions.has(permissionId)
  }, [permissions, isManager])

  return { permissions, hasPermission, loading, reload: load }
}

/**
 * Save permissions for a staff member — replaces all existing permissions.
 * Goes through the save_staff_permissions SECURITY DEFINER RPC so the anon
 * role never writes directly to staff_permissions.
 * Dispatches an event so other hook instances refresh.
 */
export async function saveStaffPermissions(staffId, venueId, permissionIds, sessionToken) {
  await supabase.rpc('save_staff_permissions', {
    p_session_token: sessionToken,
    p_staff_id:      staffId,
    p_permissions:   permissionIds,
  })

  // Bust cache
  const key = `${staffId}:${venueId}`
  delete _cache[key]
  delete _cache[key + '_ts']

  // Notify other instances
  window.dispatchEvent(new CustomEvent(PERMISSIONS_UPDATED_EVENT, { detail: { staffId, venueId } }))
}
