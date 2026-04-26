export const EU_ALLERGENS = [
  'Celery',
  'Gluten',
  'Crustaceans',
  'Eggs',
  'Fish',
  'Lupin',
  'Milk',
  'Molluscs',
  'Mustard',
  'Tree Nuts',
  'Peanuts',
  'Sesame',
  'Soya',
  'Sulphur Dioxide',
]

// Colour per allergen for badges — consistent across all pages
export const ALLERGEN_COLORS = {
  'Celery':          'bg-green-100 text-green-800',
  'Gluten':          'bg-yellow-100 text-yellow-800',
  'Crustaceans':     'bg-red-100 text-red-800',
  'Eggs':            'bg-amber-100 text-amber-800',
  'Fish':            'bg-blue-100 text-blue-800',
  'Lupin':           'bg-purple-100 text-purple-800',
  'Milk':            'bg-sky-100 text-sky-800',
  'Molluscs':        'bg-teal-100 text-teal-800',
  'Mustard':         'bg-lime-100 text-lime-800',
  'Tree Nuts':       'bg-orange-100 text-orange-800',
  'Peanuts':         'bg-rose-100 text-rose-800',
  'Sesame':          'bg-stone-100 text-stone-800',
  'Soya':            'bg-indigo-100 text-indigo-800',
  'Sulphur Dioxide': 'bg-zinc-100 text-zinc-800',
}

export const FRIDGE_SAFE_MIN = 0   // °C
export const FRIDGE_SAFE_MAX = 5   // °C

export const SESSION_TOKEN_KEY       = 'pelikn_staff_token'
export const SESSION_ID_KEY          = 'pelikn_staff_id'
export const SESSION_NAME_KEY        = 'pelikn_staff_name'
export const SESSION_ROLE_KEY        = 'pelikn_staff_role'
export const SESSION_JOB_ROLE_KEY    = 'pelikn_staff_job_role'
export const SESSION_SHOW_TEMP_LOGS  = 'pelikn_show_temp_logs'
export const SESSION_SHOW_ALLERGENS  = 'pelikn_show_allergens'
export const SESSION_VENUE_ID_KEY    = 'pelikn_venue_id'
export const SESSION_VENUE_SLUG_KEY  = 'pelikn_venue_slug'
export const SESSION_LINKED_VENUES   = 'pelikn_linked_venues'

// VAPID public key for Web Push — private key stored in Supabase secrets as VAPID_PRIVATE_KEY
export const VAPID_PUBLIC_KEY = 'BBDUCYpy030Ejbra3lzqTxIo663ciiqK_H-qCDmMQZ1wNwt9icOCYvjqhcyYAIyTIKorp4gpsS81MOp5InvjJDc'

// Rota role options with colour coding
export const ROLE_OPTIONS = [
  { label: 'Chef',            color: 'bg-orange-100 text-orange-800' },
  { label: 'Sous Chef',       color: 'bg-amber-100 text-amber-800' },
  { label: 'Kitchen Porter',  color: 'bg-yellow-100 text-yellow-800' },
  { label: 'Front of House',  color: 'bg-blue-100 text-blue-800' },
  { label: 'Bartender',       color: 'bg-purple-100 text-purple-800' },
  { label: 'Barista',         color: 'bg-teal-100 text-teal-800' },
  { label: 'Supervisor',      color: 'bg-indigo-100 text-indigo-800' },
  { label: 'Manager',         color: 'bg-rose-100 text-rose-800' },
]

// Quick shift time presets
export const SHIFT_PRESETS = [
  { label: 'Morning', start: '07:00', end: '12:00' },
  { label: 'Day',     start: '08:00', end: '15:00' },
]

// Subscription plan identifiers — single source of truth
export const PLANS = {
  STARTER: 'starter',
  PRO:     'pro',
}

// Temperature exceedance reasons that are considered "explained" (not a compliance failure)
export const EXPLAINED_EXCEEDANCE_REASONS = ['delivery', 'defrost', 'service_access']

/**
 * Rota colour palette — 10 distinct, accessible colours for staff shift pills.
 * Used by both StaffMembersSection (colour picker) and RotaWeekView (rendering).
 */
export const STAFF_COLOUR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

// ── Granular staff permissions ──────────────────────────────────────────────

export const STAFF_PERMISSIONS = [
  // Compliance
  { id: 'log_temps',        label: 'Log temperatures',       category: 'Compliance', description: 'Record fridge, cooking, hot holding and cooling temps' },
  { id: 'view_temp_logs',   label: 'View temperature logs',  category: 'Compliance', description: 'See historical temperature records' },
  { id: 'manage_cleaning',  label: 'Manage cleaning',        category: 'Compliance', description: 'Mark tasks complete and view cleaning schedule' },
  { id: 'manage_allergens', label: 'Manage allergens',       category: 'Compliance', description: 'Add/edit food items and allergen info' },
  { id: 'log_deliveries',   label: 'Log deliveries',         category: 'Compliance', description: 'Record delivery checks and temperatures' },

  // Operations
  { id: 'manage_tasks',     label: 'Manage tasks',           category: 'Operations', description: 'Create, assign and complete daily tasks' },
  { id: 'manage_opening',   label: 'Opening/closing checks', category: 'Operations', description: 'Complete opening and closing checklists' },
  { id: 'log_waste',        label: 'Log waste',              category: 'Operations', description: 'Record food waste entries' },

  // Team (elevated)
  { id: 'approve_swaps',    label: 'Approve shift swaps',    category: 'Team',       description: 'Approve or reject shift swap requests' },
  { id: 'edit_rota',        label: 'Edit rota',              category: 'Team',       description: 'Create and modify the weekly rota' },
  { id: 'view_timesheet',   label: 'View timesheets',        category: 'Team',       description: 'See hours worked and cost reports' },
  { id: 'manage_training',  label: 'Manage training',        category: 'Team',       description: 'Add/update staff training records' },
  { id: 'approve_timeoff',  label: 'Approve time off',       category: 'Team',       description: 'Approve or reject time-off requests' },
]

export const STAFF_PERMISSION_IDS = STAFF_PERMISSIONS.map(p => p.id)

/** Default permissions granted to new staff members (basic daily duties). */
export const DEFAULT_STAFF_PERMISSIONS = ['log_temps', 'manage_cleaning', 'manage_tasks', 'manage_opening']

/** Preset bundles for quick assignment in the staff edit form. */
export const PERMISSION_PRESETS = [
  { id: 'daily',  label: 'Daily Staff',  permissions: ['log_temps', 'manage_cleaning', 'manage_tasks', 'manage_opening'] },
  { id: 'senior', label: 'Senior Staff', permissions: ['log_temps', 'view_temp_logs', 'manage_cleaning', 'manage_allergens', 'log_deliveries', 'manage_tasks', 'manage_opening', 'log_waste', 'approve_swaps', 'view_timesheet'] },
  { id: 'full',   label: 'Full Access',  permissions: STAFF_PERMISSIONS.map(p => p.id) },
]

// ── Venue type presets (onboarding) ─────────────────────────────────────────

export const VENUE_PRESETS = [
  {
    id: 'cafe',
    label: 'Cafe / Coffee Shop',
    icon: 'cafe',
    description: 'Fridge checks, cleaning, allergens, simple staffing',
    features: ['fridge', 'cleaning', 'allergens', 'opening_closing', 'deliveries', 'corrective'],
    suggestedRoles: ['Barista', 'Kitchen', 'FOH'],
  },
  {
    id: 'pub',
    label: 'Pub / Bar',
    icon: 'pub',
    description: 'Cellar temps, rota management, cleaning, deliveries',
    features: ['fridge', 'cleaning', 'deliveries', 'opening_closing', 'rota', 'timesheet', 'corrective'],
    suggestedRoles: ['Bar Staff', 'Kitchen', 'Floor'],
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    icon: 'restaurant',
    description: 'Full kitchen compliance, HACCP, allergens, team management',
    features: ['fridge', 'cooking_temps', 'hot_holding', 'cooling_logs', 'cleaning', 'allergens', 'deliveries', 'opening_closing', 'probe', 'corrective', 'rota', 'timesheet', 'training'],
    suggestedRoles: ['Head Chef', 'Sous Chef', 'CDP', 'KP', 'FOH', 'Host'],
  },
  {
    id: 'hotel',
    label: 'Hotel / Catering',
    icon: 'hotel',
    description: 'Everything — full compliance, large teams, multi-department',
    features: null, // null = all features
    suggestedRoles: ['Head Chef', 'Sous Chef', 'CDP', 'KP', 'FOH', 'Concierge', 'Housekeeping'],
  },
]

export const SESSION_PERMISSIONS_KEY = 'pelikn_staff_permissions'

// Legacy aliases — kept so old code doesn't break during migration
export const STAFF_SESSION_KEY  = SESSION_TOKEN_KEY
export const STAFF_ID_KEY       = SESSION_ID_KEY
export const STAFF_NAME_KEY     = SESSION_NAME_KEY
export const STAFF_ROLE_KEY     = SESSION_ROLE_KEY
export const STAFF_JOB_ROLE_KEY = SESSION_JOB_ROLE_KEY
