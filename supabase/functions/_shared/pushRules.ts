// Who may send which push notification, and what it may contain.
//
// send-push and send-apns used to forward whatever the caller sent: any staff
// session could message the owner with any title, body and link, and the
// service worker opened that link when the app was closed. These rules are
// shared by both functions so they can't drift apart.

// Every notificationType the app sends (src/lib/notificationTypes.ts plus the
// ones the clock, timesheet and training screens use). Anything else is
// refused, which also means notification preferences are always applied.
export const PUSH_TYPES = [
  'temperature_alert',
  'late_clock_in',
  'early_clock_out',
  'unscheduled_clock_in',
  'repeat_offender',
  'corrective_action_logged',
  'time_off_request',
  'time_off_decision',
  'rota_published',
  'shift_swap_request',
  'shift_swap_decision',
  'hour_edit_request',
  'training_reminder',
] as const

const MANAGER_ROLES = ['manager', 'owner']
const ALL_ROLES = ['staff', 'manager', 'owner']
const MAX_TITLE = 100
const MAX_BODY = 300

/** An in-app path like '/time-off'. Anything else (other sites, '//host', 'javascript:') becomes '/'. */
export function safeAppPath(url: unknown): string {
  if (typeof url !== 'string') return '/'
  const path = url.trim()
  if (!/^\/(?![/\\])[A-Za-z0-9\-._~/?=&%#]*$/.test(path) || path.length > 200) return '/'
  return path
}

/** Scope a bare path to the venue, so a tap with the app closed opens the right venue. */
export function venuePath(path: string, venueSlug: string | null | undefined): string {
  if (!venueSlug || path.startsWith('/v/')) return path
  return `/v/${venueSlug}${path === '/' ? '/dashboard' : path}`
}

type PushRequest = {
  callerRole: string | null
  notificationType: unknown
  title: unknown
  body: unknown
  roles?: unknown
  staffIds?: unknown
}

type PushPlan =
  | { ok: false; status: number; error: string }
  | { ok: true; title: string; body: string; notificationType: string; roles: string[]; staffIds: string[] }

export function planPush(req: PushRequest): PushPlan {
  const isManager = MANAGER_ROLES.includes(req.callerRole ?? '')

  if (typeof req.notificationType !== 'string' || !(PUSH_TYPES as readonly string[]).includes(req.notificationType)) {
    return { ok: false, status: 400, error: 'Unknown notification type' }
  }
  const title = typeof req.title === 'string' ? req.title.trim().slice(0, MAX_TITLE) : ''
  const body  = typeof req.body  === 'string' ? req.body.trim().slice(0, MAX_BODY)   : ''
  if (!title || !body) return { ok: false, status: 400, error: 'title and body are required' }

  const staffIds = Array.isArray(req.staffIds) ? req.staffIds.filter((id): id is string => typeof id === 'string') : []
  const roles = Array.isArray(req.roles) && req.roles.length
    ? req.roles.filter((r): r is string => typeof r === 'string')
    : MANAGER_ROLES

  if (!roles.every(r => ALL_ROLES.includes(r))) return { ok: false, status: 400, error: 'Unknown role' }

  // Staff only ever notify their managers. Messaging named people or the
  // whole team is a manager action.
  if (!isManager) {
    if (staffIds.length) return { ok: false, status: 403, error: 'Only managers can notify specific people' }
    if (!roles.every(r => MANAGER_ROLES.includes(r))) return { ok: false, status: 403, error: 'Only managers can notify staff' }
  }

  return { ok: true, title, body, notificationType: req.notificationType, roles, staffIds }
}
