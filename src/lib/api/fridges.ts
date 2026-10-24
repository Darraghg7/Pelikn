import { supabase } from '../supabase'
import type { Fridge, FridgeLog, FridgeWithLastLog, FridgeTodayStatus } from '../../types'
import { insertRow, updateRowById } from './writes'
import { londonDateStr, londonDayStartInstant, nextLondonDate } from '../time'

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

  const { data: legacyData, error: legacyDataErr } = await supabase
    .from('fridges')
    .select(LEGACY_FRIDGE_COLUMNS)
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('name')
  if (legacyDataErr) throw legacyDataErr

  return (legacyData ?? []).map(withFridgeDefaults)
}

export async function fetchFridgeDashboard(venueId: string): Promise<FridgeWithLastLog[]> {
  const [fridges, { data: logs, error: logsErr }] = await Promise.all([
    fetchActiveFridges(venueId),
    supabase.from('fridge_temperature_logs').select('fridge_id, temperature, logged_at, logged_by_name')
      .eq('venue_id', venueId)
      .order('logged_at', { ascending: false })
      .limit(1000),
  ])
  if (logsErr) throw logsErr

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
  loadFridges: () => Promise<Fridge[]> = () => fetchActiveFridges(venueId),
): Promise<FridgeTodayStatus[]> {
  const today = new Date().toISOString().slice(0, 10)
  const [fridges, { data: logs, error: logsErr }] = await Promise.all([
    loadFridges(),
    supabase.from('fridge_temperature_logs')
      .select('id, fridge_id, temperature, logged_at, check_period, exceedance_reason, is_resolved, logged_by, logged_by_name, venue_id')
      .eq('venue_id', venueId)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`)
      .order('logged_at', { ascending: false }),
  ])
  if (logsErr) throw logsErr

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
  const [fridgeRows, { data: logRows, error: logRowsErr }] = await Promise.all([
    fetchActiveFridges(venueId),
    supabase
      .from('fridge_temperature_logs')
      // '*', not a column list: the audit-trail columns (163) arrive when they
      // exist, and the read doesn't break on a database that doesn't have them yet.
      .select('*')
      .eq('venue_id', venueId)
      .gte('logged_at', londonDayStartInstant(dateFrom).toISOString())
      .lt('logged_at', londonDayStartInstant(nextLondonDate(dateTo)).toISOString())
      .order('logged_at', { ascending: false }),
  ])
  if (logRowsErr) throw logRowsErr

  // Each cell is the newest reading, with any earlier ones in that slot kept
  // on `earlier`. Keeping only the newest hid a failed reading behind its
  // passing re-check; the history view now shows the failure (see
  // TempHistoryView). Days are London days, not UTC ones.
  const matrix: Record<string, Record<string, Record<string, FridgeLog & { earlier?: FridgeLog[] }>>> = {}
  for (const log of (logRows ?? [] as FridgeLog[])) {
    const day = londonDateStr(log.logged_at)
    const period = log.check_period === 'pm' ? 'pm' : 'am'
    matrix[log.fridge_id] ??= {}
    matrix[log.fridge_id][day] ??= {}
    const cell = matrix[log.fridge_id][day][period]
    if (!cell) matrix[log.fridge_id][day][period] = { ...log, earlier: [] }
    else cell.earlier!.push(log)
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

  // The date pickers hand over bare "yyyy-MM-dd" dates. Compared as-is against
  // a timestamp, `<= '2026-10-24'` means midnight at the START of the 24th, so
  // the "Today" preset always came back empty and every range lost its last
  // day. A bare date now means that whole London day: from its first instant
  // up to (not including) the next day's.
  const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (fridgeId) q = q.eq('fridge_id', fridgeId)
  if (dateFrom) q = q.gte('logged_at', isDay(dateFrom) ? londonDayStartInstant(dateFrom).toISOString() : dateFrom)
  if (dateTo)   q = isDay(dateTo)
    ? q.lt('logged_at', londonDayStartInstant(nextLondonDate(dateTo)).toISOString())
    : q.lte('logged_at', dateTo)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as FridgeLog[]
}

// ── Writes ──────────────────────────────────────────────────────────────────

/** Record one temperature reading (today's check, the log form, or a backfilled one). */
export function insertFridgeLog(row: Record<string, unknown>): Promise<void> {
  return insertRow('fridge_temperature_logs', row)
}

/** A manager adds the reason to an out-of-range reading after the fact. */
export function setFridgeLogReason(venueId: string, logId: string, reason: string | null): Promise<void> {
  return updateRowById('fridge_temperature_logs', logId, { exceedance_reason: reason }, venueId, 'That reading no longer exists')
}

export function createFridge(venueId: string, values: Record<string, unknown>): Promise<void> {
  return insertRow('fridges', { ...values, venue_id: venueId })
}

/** Removing a fridge hides it; its past readings stay. */
export function deactivateFridge(venueId: string, fridgeId: string): Promise<void> {
  return updateRowById('fridges', fridgeId, { is_active: false }, venueId, 'That fridge no longer exists')
}

export function updateFridge(venueId: string, fridgeId: string, values: Record<string, unknown>): Promise<void> {
  return updateRowById('fridges', fridgeId, values, venueId, 'That fridge no longer exists')
}
