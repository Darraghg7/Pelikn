import { supabase } from '../supabase'
import type { Fridge, FridgeLog, FridgeWithLastLog, FridgeTodayStatus } from '../../types'

const FRIDGE_COLUMNS = 'id, name, is_active, min_temp, max_temp, check_days, required_periods, venue_id'
const LEGACY_FRIDGE_COLUMNS = 'id, name, is_active, min_temp, max_temp, venue_id'

function withFridgeDefaults(fridge: Partial<Fridge>): Fridge {
  return {
    ...fridge,
    check_days: fridge.check_days ?? [0, 1, 2, 3, 4, 5, 6],
    required_periods: fridge.required_periods ?? ['am', 'pm'],
  } as Fridge
}

export async function fetchActiveFridges(venueId: string): Promise<Fridge[]> {
  const { data, error } = await supabase
    .from('fridges')
    .select(FRIDGE_COLUMNS)
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('name')

  if (!error) return (data ?? []).map(withFridgeDefaults)

  const { data: legacyData } = await supabase
    .from('fridges')
    .select(LEGACY_FRIDGE_COLUMNS)
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('name')

  return (legacyData ?? []).map(withFridgeDefaults)
}

export async function fetchFridgeDashboard(venueId: string): Promise<FridgeWithLastLog[]> {
  const [fridges, { data: logs }] = await Promise.all([
    fetchActiveFridges(venueId),
    supabase.from('fridge_temperature_logs').select('fridge_id, temperature, logged_at, logged_by_name')
      .eq('venue_id', venueId)
      .order('logged_at', { ascending: false })
      .limit(1000),
  ])

  const seen = new Set<string>()
  const latestByFridge: Record<string, FridgeLog> = {}
  for (const log of (logs ?? [] as FridgeLog[])) {
    if (!seen.has(log.fridge_id)) {
      seen.add(log.fridge_id)
      latestByFridge[log.fridge_id] = log
    }
  }

  return fridges.map(f => ({ ...f, lastLog: latestByFridge[f.id] ?? null }))
}

export async function fetchTodayCheckStatus(
  venueId: string,
  isCheckRequired: (item: Fridge, date: Date, period: string) => boolean,
): Promise<FridgeTodayStatus[]> {
  const today = new Date().toISOString().slice(0, 10)
  const [fridges, { data: logs }] = await Promise.all([
    fetchActiveFridges(venueId),
    supabase.from('fridge_temperature_logs')
      .select('id, fridge_id, temperature, logged_at, check_period, exceedance_reason, is_resolved, logged_by, logged_by_name, venue_id')
      .eq('venue_id', venueId)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`)
      .order('logged_at', { ascending: false }),
  ])

  const now = new Date()
  return (fridges ?? []).map(f => {
    const fridgeLogs = (logs ?? [] as FridgeLog[]).filter(l => l.fridge_id === f.id)
    const am = fridgeLogs.find(l => l.check_period === 'am') ?? null
    const pm = fridgeLogs.find(l => l.check_period === 'pm') ?? null
    return {
      ...f,
      am,
      pm,
      amRequired: isCheckRequired(f, now, 'am'),
      pmRequired: isCheckRequired(f, now, 'pm'),
    }
  })
}

export async function fetchFridgeMatrix(
  venueId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ fridges: Fridge[]; matrix: Record<string, Record<string, Record<string, FridgeLog>>> }> {
  const [fridgeRows, { data: logRows }] = await Promise.all([
    fetchActiveFridges(venueId),
    supabase
      .from('fridge_temperature_logs')
      .select('id, fridge_id, temperature, logged_at, check_period, exceedance_reason, logged_by_name, notes')
      .eq('venue_id', venueId)
      .gte('logged_at', `${dateFrom}T00:00:00`)
      .lte('logged_at', `${dateTo}T23:59:59`)
      .order('logged_at', { ascending: false }),
  ])

  const matrix: Record<string, Record<string, Record<string, FridgeLog>>> = {}
  for (const log of (logRows ?? [] as FridgeLog[])) {
    const day = log.logged_at.slice(0, 10)
    const period = log.check_period === 'pm' ? 'pm' : 'am'
    matrix[log.fridge_id] ??= {}
    matrix[log.fridge_id][day] ??= {}
    if (!matrix[log.fridge_id][day][period]) {
      matrix[log.fridge_id][day][period] = log
    }
  }

  return { fridges: fridgeRows, matrix }
}

export async function fetchFridgeHistory(
  venueId: string,
  fridgeId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
): Promise<FridgeLog[]> {
  let q = supabase
    .from('fridge_temperature_logs')
    .select('*, fridges(name, min_temp, max_temp)')
    .eq('venue_id', venueId)
    .order('logged_at', { ascending: false })

  if (fridgeId) q = q.eq('fridge_id', fridgeId)
  if (dateFrom) q = q.gte('logged_at', dateFrom)
  if (dateTo)   q = q.lte('logged_at', dateTo)

  const { data } = await q
  return (data ?? []) as FridgeLog[]
}
