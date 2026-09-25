import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { hashPin, pinHashKey } from '../lib/offlinePin'
import { takeBootstrap } from '../lib/api/bootstrap'

export interface ManagerOption {
  id: string
  name: string
  role: string
  photo_url?: string | null
}

/**
 * This venue's managers/owners, for a manager-PIN override screen. Read from
 * the staff cache populated at login (no extra fetch) when available, falling
 * back to the DB so the screen always has managers to pick from even on a
 * device with no cache. Extracted from useClockAlerts.js so a second override
 * screen (the closing-checklist gate) doesn't reimplement it a second time.
 */
export function useManagers(venueId: string | null | undefined): ManagerOption[] {
  // A shared query key rather than per-component state: useClockAlerts and
  // useClosingCheckoutGuard both call this on the same dashboard, and each
  // used to fire its own identical request. staleTime Infinity keeps the old
  // fetch-once-per-mount-tree behaviour — the list only feeds a PIN picker.
  const { data } = useQuery({
    queryKey: ['managers', venueId],
    queryFn: async () => {
      // First load comes from the startup bundle when it's available (126).
      const boot = await takeBootstrap(venueId, 'managers')
      if (boot) return boot.managers as ManagerOption[]
      const { data } = await supabase
        .from('staff')
        .select('id, name, role, photo_url')
        .eq('venue_id', venueId!)
        .eq('is_active', true)
        .in('role', ['manager', 'owner'])
        .order('name')
      return (data ?? []) as ManagerOption[]
    },
    enabled: !!venueId,
    initialData: () => managersFromCache(venueId),
    staleTime: Infinity,
  })

  return venueId ? data ?? [] : []
}

/** Managers from the staff list cached at login, or undefined to fetch. */
function managersFromCache(venueId: string | null | undefined): ManagerOption[] | undefined {
  if (!venueId) return undefined
  try {
    const cached = localStorage.getItem(`pelikn_staff_${venueId}`)
    const all = cached ? JSON.parse(cached) : []
    const fromCache = all.filter((s: ManagerOption) => s.role === 'manager' || s.role === 'owner')
    return fromCache.length > 0 ? fromCache : undefined
  } catch {
    return undefined
  }
}

/**
 * Verify a manager's PIN — online first, offline hash fallback (the cached
 * hash SessionContext stores under pinHashKey(staffId) after that manager's
 * last online login on this device). `managers` should already be
 * pre-filtered to manager/owner roles, so a hash match is enough on its own —
 * the online path double-checks the role returned by the server.
 */
export async function verifyManagerPin(
  venueId: string,
  managerId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/pin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ action: 'verify_pin', staff_id: managerId, pin, venue_id: venueId }),
      signal: AbortSignal.timeout(6000),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      if (!['manager', 'owner'].includes(data.role)) {
        return { ok: false, error: "This account doesn't have manager access" }
      }
      return { ok: true }
    }
    if (res.status === 429) return { ok: false, error: 'Too many attempts — wait a moment' }
    return { ok: false, error: 'Incorrect PIN, try again' }
  } catch { /* network unreachable — fall through to the offline check */ }

  const cachedHash = localStorage.getItem(pinHashKey(managerId))
  if (!cachedHash) {
    return { ok: false, error: "Couldn't reach the server — check your connection and try again" }
  }
  const enteredHash = await hashPin(managerId, pin)
  if (!enteredHash || enteredHash !== cachedHash) {
    return { ok: false, error: 'Incorrect PIN, try again' }
  }
  return { ok: true }
}
