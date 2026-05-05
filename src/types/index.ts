// Domain types used across the app.
// These will be superseded by generated Supabase types once `supabase gen types` is run.

export interface Staff {
  id: string
  name: string
  email?: string
  role?: string
  job_role?: string
  hourly_rate?: number
  skills?: string[]
  is_under_18?: boolean
  colour?: string
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

export interface PermissionPreset {
  id: string
  label: string
  permissions: string[]
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
  job_role?: string
  is_active: boolean
  venue_id: string
  created_at: string
}

export interface TaskOneOff {
  id: string
  title: string
  job_role?: string
  due_date: string
  assigned_to_staff_id?: string
  venue_id: string
  created_at: string
}

export interface TaskCompletion {
  id: string
  task_template_id?: string
  task_one_off_id?: string
  completion_date: string
  staff_id?: string
  venue_id: string
}
