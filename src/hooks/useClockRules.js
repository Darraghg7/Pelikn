import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { useToast } from '../components/ui/Toast'
import { isNetworkError } from '../lib/offlineSupabase'
import { readPersisted, writePersisted } from '../lib/persistedCache'
import {
  fetchClockRules, setClockLocationRule, registerClockDevice, setClockDeviceRule, clearClockDevice,
} from '../lib/api/clockRules'
import {
  RULES_OFF, getPosition, isThisTablet, saveTabletCredentials, clearTabletCredentials,
} from '../lib/clockRules'

const CACHE_NAME = 'clock_rules'

/** PostgREST's answer when 157 hasn't been applied yet: no such function. */
const isMissingFunction = (error) => error?.code === 'PGRST202' || error?.code === '42883'

/**
 * The venue's clock-in rules (location fence, clock-in tablet).
 *
 * Read with the last known rules as the fallback when offline, so a phone
 * with no signal at the venue still applies the rules it last saw (the server
 * checks them again when the punch arrives). Before migration 157 is applied
 * the rules read as off and `available` is false.
 *
 * Staff members read this to know what to ask their phone for; managers use
 * the save* helpers from Settings → Attendance.
 */
export function useClockRules() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const toast = useToast()
  const queryKey = ['clockRules', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!venueId,
    staleTime: 30_000,
    placeholderData: () => {
      const cached = readPersisted(CACHE_NAME, venueId)
      return cached ? { rules: cached, available: true } : undefined
    },
    queryFn: async () => {
      try {
        const { data: rules, error } = await fetchClockRules(venueId)
        if (error) throw error
        const merged = { ...RULES_OFF, ...rules }
        writePersisted(CACHE_NAME, venueId, merged)
        return { rules: merged, available: true }
      } catch (err) {
        if (isMissingFunction(err)) return { rules: RULES_OFF, available: false }
        // Offline: keep applying whatever rules this phone last saw.
        if (isNetworkError(err)) {
          const cached = readPersisted(CACHE_NAME, venueId)
          if (cached) return { rules: cached, available: true }
          return { rules: RULES_OFF, available: true }
        }
        throw err
      }
    },
  })

  const rules = data?.rules ?? RULES_OFF
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['clockRules', venueId] }), [queryClient, venueId])

  // Each save resolves to true on success; on failure the reason is toasted.
  const run = useCallback(async (action, failure) => {
    const { error } = await action()
    if (error) {
      toast(error.message || failure, 'error')
      return false
    }
    await refresh()
    return true
  }, [toast, refresh])

  /** Turn the location rule on/off. Turning it on with no saved point saves where the manager is standing. */
  const saveLocationRule = useCallback(async (enabled) => {
    let point
    if (enabled && (rules.latitude == null || rules.longitude == null)) {
      try {
        const p = await getPosition()
        point = { latitude: p.latitude, longitude: p.longitude }
      } catch (err) {
        toast(err.message, 'error')
        return false
      }
    }
    return run(() => setClockLocationRule(venueId, enabled, point), "Couldn't save — try again")
  }, [venueId, rules.latitude, rules.longitude, run, toast])

  /** Save where the manager is standing as the venue's point. */
  const saveVenuePoint = useCallback(async () => {
    try {
      const p = await getPosition()
      const ok = await run(
        () => setClockLocationRule(venueId, rules.require_location, { latitude: p.latitude, longitude: p.longitude }),
        "Couldn't save — try again",
      )
      return ok ? p : null
    } catch (err) {
      toast(err.message, 'error')
      return null
    }
  }, [venueId, rules.require_location, run, toast])

  const saveRadius = useCallback(
    (radiusM) => run(() => setClockLocationRule(venueId, rules.require_location, undefined, radiusM), "Couldn't save — try again"),
    [venueId, rules.require_location, run],
  )

  /** Make the device in the manager's hand the clock-in tablet. */
  const registerThisDevice = useCallback(async () => {
    const { data: creds, error } = await registerClockDevice(venueId)
    if (error) { toast(error.message || "Couldn't register this device", 'error'); return false }
    saveTabletCredentials(venueId, creds)
    await refresh()
    return true
  }, [venueId, refresh, toast])

  const saveDeviceRule = useCallback(
    (enabled) => run(() => setClockDeviceRule(venueId, enabled), "Couldn't save — try again"),
    [venueId, run],
  )

  const forgetDevice = useCallback(async () => {
    const ok = await run(() => clearClockDevice(venueId), "Couldn't remove the tablet — try again")
    if (ok) clearTabletCredentials(venueId)
    return ok
  }, [venueId, run])

  return {
    rules,
    available: data?.available ?? true,
    loading: isLoading,
    thisIsTablet: isThisTablet(rules, venueId),
    saveLocationRule, saveVenuePoint, saveRadius,
    registerThisDevice, saveDeviceRule, forgetDevice,
  }
}
