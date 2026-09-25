/**
 * Cooling log rules — pure helpers shared by the Cooling logs page and the
 * compliance export. A batch passes when it reaches ≤8°C within 90 minutes.
 */
export const COOLING_TARGET_TEMP    = 8   // ≤8°C required by UK food safety regs
export const COOLING_TARGET_MINUTES = 90  // …reached within 90 minutes

// `legacy` methods stay readable on old records but aren't offered for new batches
export const COOLING_METHODS = [
  { value: 'blast_chiller', label: 'Blast chiller' },
  { value: 'ice_bath',      label: 'Ice bath' },
  { value: 'fridge',        label: 'Fridge' },
  { value: 'ambient',       label: 'Ambient' },
  { value: 'cold_water',    label: 'Cold running water', legacy: true },
  { value: 'other',         label: 'Other',              legacy: true },
]

export function coolingMethodLabel(value: string): string {
  return COOLING_METHODS.find(m => m.value === value)?.label ?? value
}

export interface CoolingLog {
  id: string
  food_item: string
  start_temp: number
  end_temp: number | null        // null = still cooling (120)
  target_temp: number
  cooling_method: string
  started_at: string
  finished_at?: string | null    // null on batches logged before 120
  logged_at: string
  logged_by?: string | null
  logged_by_name?: string
  notes?: string | null
  venue_id: string
}

/** Returns true if the end temperature is above the safe threshold */
export function isCoolingTempFail(endTemp: number | string, targetTemp = COOLING_TARGET_TEMP): boolean {
  return Number(endTemp) > targetTemp
}

/** Minutes from start to finish, or null when the finish time wasn't recorded. */
export function coolingMinutes(log: Pick<CoolingLog, 'started_at' | 'finished_at'>): number | null {
  if (!log.finished_at) return null
  return Math.max(0, Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 60000))
}

/**
 * Pass/fail for a finished batch. A cool fails if it ended above the target
 * temperature, or took longer than 90 minutes to get there. Batches logged
 * before finish times were recorded are judged on temperature alone.
 */
export function coolingOutcome(log: CoolingLog): { fail: boolean; reason: 'too_warm' | 'too_slow' | null; minutes: number | null } {
  const minutes  = coolingMinutes(log)
  const tooSlow  = minutes !== null && minutes > COOLING_TARGET_MINUTES
  const tooWarm  = isCoolingTempFail(log.end_temp ?? 0, log.target_temp ?? COOLING_TARGET_TEMP)
  return { fail: tooSlow || tooWarm, reason: tooSlow ? 'too_slow' : tooWarm ? 'too_warm' : null, minutes }
}

/** "1h 25m" / "43m" */
export function formatCoolingMinutes(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
