// Domain types used across the app.
// These will be superseded by generated Supabase types once `supabase gen types` is run.

export interface Staff {
  id: string
  name: string
  email?: string
  role?: string
  job_role?: string
  /** Job titles held (venue_roles), in Settings order — see useStaffJobTitles. */
  job_titles?: string[]
  /** The first of job_titles, for single-label places. */
  job_title?: string | null
  hourly_rate?: number
  skills?: string[]
  is_under_18?: boolean
  colour?: string
  photo_url?: string | null
  is_active?: boolean
  venue_id?: string
  _crossVenue?: boolean
}

export interface Shift {
  id: string
  venue_id: string
  staff_id: string | null
  week_start: string
  shift_date: string
  start_time: string
  end_time: string
  role?: string
  /** What the person is doing on the shift (NOT NULL in the database). */
  role_label?: string | null
  /** Closing shift: they own their department's closing tasks. */
  is_closing?: boolean
  notes?: string
  is_closure?: boolean
  staff?: Staff
}

export interface Fridge {
  id: string
  name: string
  is_active: boolean
  min_temp: number
  max_temp: number
  check_days: number[]
  required_periods: string[]
  venue_id: string
}

export interface FridgeLog {
  id?: string
  fridge_id: string
  temperature: number
  logged_at: string
  check_period?: string
  exceedance_reason?: string
  is_resolved?: boolean
  logged_by?: string
  logged_by_name?: string
  notes?: string
  venue_id?: string
  fridge_name?: string
  // Audit trail (migration 163). Absent, or null, on readings from before it.
  /** When the row reached the database. logged_at is when the reading says it was taken. */
  recorded_at?: string | null
  /** Entered more than 30 minutes after the time it records. */
  is_backfilled?: boolean
  /** The fridge's range when the reading was taken; pass/fail uses this. */
  range_min?: number | null
  range_max?: number | null
  reason_previous?: string | null
  reason_changed_at?: string | null
  reason_changed_by?: string | null
  /** Embedded by fetchFridgeHistory's `fridges(name, min_temp, max_temp)` join. */
  fridges?: { name: string; min_temp: number; max_temp: number } | null
}

export interface FridgeWithLastLog extends Fridge {
  lastLog: FridgeLog | null
}

export interface FridgeTodayStatus extends Fridge {
  am: FridgeLog | null
  pm: FridgeLog | null
  amRequired: boolean
  pmRequired: boolean
}

export interface CheckableItem {
  check_days?: number[] | null
  required_periods?: string[] | null
}

export interface StaffPermission {
  id: string
  label: string
  category: string
  description: string
}

export interface VenuePreset {
  id: string
  label: string
  icon: string
  description: string
  features: string[] | null
  suggestedRoles: string[]
}

export interface NotificationType {
  id: string
  label: string
  description: string
}

export interface TaskTemplate {
  id: string
  title: string
  department_id?: string | null
  is_active: boolean
  venue_id: string
  created_at: string
}

export interface TaskOneOff {
  id: string
  title: string
  department_id?: string | null
  due_date: string
  assigned_to_staff_id?: string
  assigned_to_name?: string | null
  venue_id: string
  created_at: string
}

export interface TaskCompletion {
  id: string
  task_template_id?: string
  task_one_off_id?: string
  completion_date: string
  completed_by_staff_id?: string
  completed_by_name?: string
  venue_id: string
}
