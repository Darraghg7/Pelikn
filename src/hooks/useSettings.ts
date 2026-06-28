import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

// New venues start with no roles — each venue configures their own in Settings
const DEFAULT_ROLES: CustomRole[] = []

// Palette for auto-assigning colours to new roles
const COLOR_PALETTE = [
  'bg-orange-100 text-orange-800',
  'bg-amber-100 text-amber-800',
  'bg-yellow-100 text-yellow-800',
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
  'bg-green-100 text-green-800',
  'bg-pink-100 text-pink-800',
  'bg-sky-100 text-sky-800',
  'bg-red-100 text-red-800',
  'bg-stone-100 text-stone-800',
]

const SETTINGS_KEYS = ['custom_roles', 'closed_days', 'break_duration_mins', 'cleanup_minutes', 'fridge_check_time', 'open_time', 'close_time', 'day_hours', 'compliance_nav_order', 'action_schedules', 'late_grace_mins', 'break_overrun_grace_mins', 'require_late_reason', 'notify_manager_at_strike', 'disciplinary_at_strike', 'counting_window_days', 'push_to_manager', 'notify_break_overrun', 'hidden_check_tiles', 'hidden_team_tiles']

interface CustomRole {
  value: string
  label: string
  color: string
}

interface ActionSchedule {
  enabled: boolean
  days: number[]
}

type ActionSchedules = Record<string, ActionSchedule>

interface DayHours { open: string; close: string }

interface AppSettings {
  customRoles: CustomRole[]
  closedDays: number[]
  breakDurationMins: number
  cleanupMinutes: number
  fridgeCheckTime: string
  openTime: string
  closeTime: string
  dayHours: Record<string, DayHours>
  complianceNavOrder: string[]
  actionSchedules: ActionSchedules
  // Attendance rules (drives ClockPanel + Staff Alert thresholds)
  lateGraceMins: number
  breakOverrunGraceMins: number
  requireLateReason: boolean
  requireManagerApprovalForLate: boolean
  notifyManagerAtStrike: number
  disciplinaryAtStrike: number
  countingWindowDays: number
  pushToManager: boolean
  notifyBreakOverrun: boolean
  hiddenCheckTiles: string[]
  hiddenTeamTiles: string[]
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

const DEFAULT_ACTION_SCHEDULES: ActionSchedules = {
  opening_checks:  { enabled: true, days: ALL_DAYS },
  closing_checks:  { enabled: true, days: ALL_DAYS },
  fridge_checks:   { enabled: true, days: ALL_DAYS },
  cleaning_tasks:  { enabled: true, days: ALL_DAYS },
  cooking_temps:   { enabled: true, days: ALL_DAYS },
  hot_holding:     { enabled: true, days: ALL_DAYS },
  cooling_logs:    { enabled: true, days: ALL_DAYS },
}

const DEFAULTS: AppSettings = {
  customRoles: DEFAULT_ROLES,
  closedDays: [],
  breakDurationMins: 30,
  cleanupMinutes: 0,
  fridgeCheckTime: '10:00',
  openTime: '08:00',
  closeTime: '17:00',
  dayHours: {},
  complianceNavOrder: [],
  actionSchedules: DEFAULT_ACTION_SCHEDULES,
  lateGraceMins: 0,
  breakOverrunGraceMins: 5,
  requireLateReason: true,
  requireManagerApprovalForLate: true,
  notifyManagerAtStrike: 3,
  disciplinaryAtStrike: 4,
  countingWindowDays: 30,
  pushToManager: true,
  notifyBreakOverrun: false,
  hiddenCheckTiles: [],
  hiddenTeamTiles: [],
}

async function fetchAppSettings(venueId: string): Promise<AppSettings> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('venue_id', venueId)
    .in('key', SETTINGS_KEYS)

  const result: AppSettings = { ...DEFAULTS }

  if (data) {
    for (const row of data) {
      try {
        const parsed = JSON.parse(row.value)
        if (row.key === 'custom_roles' && Array.isArray(parsed) && parsed.length > 0) {
          // Normalise: legacy venues store roles as plain strings; new ones store {value,label,color}
          result.customRoles = parsed.map((r: unknown, i: number) => {
            if (typeof r === 'string') {
              return { value: r.toLowerCase().replace(/\s+/g, '_'), label: r, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }
            }
            return r as CustomRole
          })
        }
        if (row.key === 'closed_days' && Array.isArray(parsed)) {
          result.closedDays = parsed
        }
        if (row.key === 'break_duration_mins' && typeof parsed === 'number') {
          result.breakDurationMins = parsed
        }
        if (row.key === 'cleanup_minutes' && typeof parsed === 'number') {
          result.cleanupMinutes = parsed
        }
        if (row.key === 'fridge_check_time' && typeof parsed === 'string') {
          result.fridgeCheckTime = parsed
        }
        if (row.key === 'open_time' && typeof parsed === 'string') {
          result.openTime = parsed
        }
        if (row.key === 'close_time' && typeof parsed === 'string') {
          result.closeTime = parsed
        }
        if (row.key === 'compliance_nav_order' && Array.isArray(parsed)) {
          result.complianceNavOrder = parsed
        }
        if (row.key === 'action_schedules' && typeof parsed === 'object' && parsed !== null) {
          result.actionSchedules = { ...DEFAULT_ACTION_SCHEDULES, ...parsed }
        }
        if (row.key === 'late_grace_mins'          && typeof parsed === 'number')  result.lateGraceMins = parsed
        if (row.key === 'break_overrun_grace_mins' && typeof parsed === 'number')  result.breakOverrunGraceMins = parsed
        if (row.key === 'require_late_reason'               && typeof parsed === 'boolean') result.requireLateReason = parsed
        if (row.key === 'require_manager_approval_for_late' && typeof parsed === 'boolean') result.requireManagerApprovalForLate = parsed
        if (row.key === 'notify_manager_at_strike' && typeof parsed === 'number')  result.notifyManagerAtStrike = parsed
        if (row.key === 'disciplinary_at_strike'   && typeof parsed === 'number')  result.disciplinaryAtStrike = parsed
        if (row.key === 'counting_window_days'     && typeof parsed === 'number')  result.countingWindowDays = parsed
        if (row.key === 'push_to_manager'          && typeof parsed === 'boolean') result.pushToManager = parsed
        if (row.key === 'day_hours' && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) result.dayHours = parsed
        if (row.key === 'notify_break_overrun' && typeof parsed === 'boolean') result.notifyBreakOverrun = parsed
        if (row.key === 'hidden_check_tiles' && Array.isArray(parsed)) result.hiddenCheckTiles = parsed
        if (row.key === 'hidden_team_tiles'  && Array.isArray(parsed)) result.hiddenTeamTiles = parsed
      } catch { /* ignore corrupt JSON — leave defaults */ }
    }
  }

  return result
}

/**
 * Shared hook for app-wide settings stored in `app_settings`.
 * Returns customRoles, closedDays, breakDurationMins and helpers to persist changes.
 */
export function useAppSettings() {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const queryKey = ['app-settings', venueId]

  const { data, isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => fetchAppSettings(venueId),
    enabled: !!venueId,
    placeholderData: DEFAULTS,
    staleTime: 30_000,
  })

  const rawSettings = data ?? DEFAULTS
  // Normalise customRoles regardless of cache age — legacy venues store roles as plain strings
  const settings: AppSettings = {
    ...rawSettings,
    customRoles: rawSettings.customRoles.map((r: unknown, i: number) => {
      if (typeof r === 'string') {
        return { value: r.toLowerCase().replace(/\s+/g, '_'), label: r, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }
      }
      return r as CustomRole
    }),
  }

  const saveSetting = useCallback(async (key: string, value: unknown) => {
    if (!venueId) return
    // Optimistically update cache
    queryClient.setQueryData(queryKey, (old: AppSettings | undefined) => {
      const fieldMap: Record<string, keyof AppSettings> = {
        custom_roles: 'customRoles',
        closed_days: 'closedDays',
        break_duration_mins: 'breakDurationMins',
        cleanup_minutes: 'cleanupMinutes',
        fridge_check_time: 'fridgeCheckTime',
        open_time: 'openTime',
        close_time: 'closeTime',
        day_hours: 'dayHours',
        compliance_nav_order: 'complianceNavOrder',
        action_schedules: 'actionSchedules',
        late_grace_mins: 'lateGraceMins',
        break_overrun_grace_mins: 'breakOverrunGraceMins',
        require_late_reason: 'requireLateReason',
        require_manager_approval_for_late: 'requireManagerApprovalForLate',
        notify_manager_at_strike: 'notifyManagerAtStrike',
        disciplinary_at_strike: 'disciplinaryAtStrike',
        counting_window_days: 'countingWindowDays',
        push_to_manager: 'pushToManager',
        notify_break_overrun: 'notifyBreakOverrun',
        hidden_check_tiles: 'hiddenCheckTiles',
        hidden_team_tiles: 'hiddenTeamTiles',
      }
      return { ...(old ?? DEFAULTS), [fieldMap[key]]: value }
    })
    await supabase
      .from('app_settings')
      .upsert({ venue_id: venueId, key, value: JSON.stringify(value) }, { onConflict: 'venue_id,key' })
  }, [venueId, queryClient, queryKey])

  const saveCustomRoles = useCallback((roles: CustomRole[]) => saveSetting('custom_roles', roles), [saveSetting])
  const saveClosedDays = useCallback((days: number[]) => saveSetting('closed_days', days), [saveSetting])
  const saveBreakDuration = useCallback((mins: number) => saveSetting('break_duration_mins', mins), [saveSetting])
  const saveCleanupMinutes = useCallback((mins: number) => saveSetting('cleanup_minutes', mins), [saveSetting])
  const saveFridgeCheckTime = useCallback((time: string) => saveSetting('fridge_check_time', time), [saveSetting])
  const saveOpenTime = useCallback((time: string) => saveSetting('open_time', time), [saveSetting])
  const saveCloseTime = useCallback((time: string) => saveSetting('close_time', time), [saveSetting])
  const saveComplianceNavOrder = useCallback((order: string[]) => saveSetting('compliance_nav_order', order), [saveSetting])
  const saveActionSchedules = useCallback((schedules: ActionSchedules) => saveSetting('action_schedules', schedules), [saveSetting])
  const saveLateGraceMins = useCallback((mins: number) => saveSetting('late_grace_mins', mins), [saveSetting])
  const saveBreakOverrunGraceMins = useCallback((mins: number) => saveSetting('break_overrun_grace_mins', mins), [saveSetting])
  const saveRequireLateReason = useCallback((v: boolean) => saveSetting('require_late_reason', v), [saveSetting])
  const saveRequireManagerApprovalForLate = useCallback((v: boolean) => saveSetting('require_manager_approval_for_late', v), [saveSetting])
  const saveNotifyManagerAtStrike = useCallback((n: number) => saveSetting('notify_manager_at_strike', n), [saveSetting])
  const saveDisciplinaryAtStrike = useCallback((n: number) => saveSetting('disciplinary_at_strike', n), [saveSetting])
  const saveCountingWindowDays = useCallback((n: number) => saveSetting('counting_window_days', n), [saveSetting])
  const savePushToManager = useCallback((v: boolean) => saveSetting('push_to_manager', v), [saveSetting])
  const saveNotifyBreakOverrun = useCallback((v: boolean) => saveSetting('notify_break_overrun', v), [saveSetting])
  const saveDayHours = useCallback((hours: Record<string, DayHours>) => saveSetting('day_hours', hours), [saveSetting])
  const saveHiddenCheckTiles = useCallback((ids: string[]) => saveSetting('hidden_check_tiles', ids), [saveSetting])
  const saveHiddenTeamTiles = useCallback((ids: string[]) => saveSetting('hidden_team_tiles', ids), [saveSetting])

  /** Pick the next unused colour from the palette. Falls back to the least-used colour. */
  const nextColor = useCallback(() => {
    const used = new Set(settings.customRoles.map(r => r.color))
    const unused = COLOR_PALETTE.find(c => !used.has(c))
    if (unused) return unused
    // All colours in use — count usage and return the least-used one
    const counts: Record<string, number> = Object.fromEntries(COLOR_PALETTE.map(c => [c, 0]))
    settings.customRoles.forEach(r => { if (counts[r.color] !== undefined) counts[r.color]++ })
    return COLOR_PALETTE.reduce((a, b) => counts[a] <= counts[b] ? a : b)
  }, [settings.customRoles])

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return {
    customRoles: settings.customRoles,
    closedDays: settings.closedDays,
    breakDurationMins: settings.breakDurationMins,
    cleanupMinutes: settings.cleanupMinutes,
    fridgeCheckTime: settings.fridgeCheckTime,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    dayHours: settings.dayHours,
    complianceNavOrder: settings.complianceNavOrder,
    actionSchedules: settings.actionSchedules,
    lateGraceMins: settings.lateGraceMins,
    breakOverrunGraceMins: settings.breakOverrunGraceMins,
    requireLateReason: settings.requireLateReason,
    requireManagerApprovalForLate: settings.requireManagerApprovalForLate,
    notifyManagerAtStrike: settings.notifyManagerAtStrike,
    disciplinaryAtStrike: settings.disciplinaryAtStrike,
    countingWindowDays: settings.countingWindowDays,
    pushToManager: settings.pushToManager,
    notifyBreakOverrun: settings.notifyBreakOverrun,
    hiddenCheckTiles: settings.hiddenCheckTiles,
    hiddenTeamTiles: settings.hiddenTeamTiles,
    loading,
    saveCustomRoles, saveClosedDays, saveBreakDuration, saveCleanupMinutes, saveFridgeCheckTime,
    saveOpenTime, saveCloseTime, saveDayHours, saveComplianceNavOrder, saveActionSchedules,
    saveLateGraceMins, saveBreakOverrunGraceMins, saveRequireLateReason, saveRequireManagerApprovalForLate,
    saveNotifyManagerAtStrike, saveDisciplinaryAtStrike, saveCountingWindowDays, savePushToManager, saveNotifyBreakOverrun,
    saveHiddenCheckTiles, saveHiddenTeamTiles,
    nextColor, reload,
  }
}
