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

// Legacy aliases — kept so old code doesn't break during migration
export const STAFF_SESSION_KEY  = SESSION_TOKEN_KEY
export const STAFF_ID_KEY       = SESSION_ID_KEY
export const STAFF_NAME_KEY     = SESSION_NAME_KEY
export const STAFF_ROLE_KEY     = SESSION_ROLE_KEY
export const STAFF_JOB_ROLE_KEY = SESSION_JOB_ROLE_KEY
