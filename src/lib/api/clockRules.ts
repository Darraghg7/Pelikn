import { supabase } from '../supabase'

/** What get_clock_rules (157) returns. The tablet's secret is never in it. */
export interface ClockRules {
  require_location: boolean
  latitude: number | null
  longitude: number | null
  radius_m: number
  require_device: boolean
  device_id: string | null
  device_name: string | null
  device_registered_at: string | null
}

export function fetchClockRules(venueId: string) {
  return supabase.rpc('get_clock_rules', { p_venue_id: venueId })
}

export function setClockLocationRule(
  venueId: string,
  enabled: boolean,
  point?: { latitude: number; longitude: number },
  radiusM?: number,
) {
  return supabase.rpc('set_clock_location_rule', {
    p_venue_id: venueId,
    p_enabled: enabled,
    p_latitude: point?.latitude ?? null,
    p_longitude: point?.longitude ?? null,
    p_radius_m: radiusM ?? null,
  })
}

export function registerClockDevice(venueId: string, name?: string) {
  return supabase.rpc('register_clock_device', { p_venue_id: venueId, p_name: name ?? null })
}

export function setClockDeviceRule(venueId: string, enabled: boolean) {
  return supabase.rpc('set_clock_device_rule', { p_venue_id: venueId, p_enabled: enabled })
}

export function clearClockDevice(venueId: string) {
  return supabase.rpc('clear_clock_device', { p_venue_id: venueId })
}
