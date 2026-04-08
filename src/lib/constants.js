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

export const SESSION_TOKEN_KEY       = 'safeserv_staff_token'
export const SESSION_ID_KEY          = 'safeserv_staff_id'
export const SESSION_NAME_KEY        = 'safeserv_staff_name'
export const SESSION_ROLE_KEY        = 'safeserv_staff_role'
export const SESSION_JOB_ROLE_KEY    = 'safeserv_staff_job_role'
export const SESSION_SHOW_TEMP_LOGS  = 'safeserv_show_temp_logs'
export const SESSION_SHOW_ALLERGENS  = 'safeserv_show_allergens'
export const SESSION_VENUE_ID_KEY    = 'safeserv_venue_id'
export const SESSION_VENUE_SLUG_KEY  = 'safeserv_venue_slug'
export const SESSION_LINKED_VENUES   = 'safeserv_linked_venues'

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

// Legacy aliases — kept so old code doesn't break during migration
export const STAFF_SESSION_KEY  = SESSION_TOKEN_KEY
export const STAFF_ID_KEY       = SESSION_ID_KEY
export const STAFF_NAME_KEY     = SESSION_NAME_KEY
export const STAFF_ROLE_KEY     = SESSION_ROLE_KEY
export const STAFF_JOB_ROLE_KEY = SESSION_JOB_ROLE_KEY
