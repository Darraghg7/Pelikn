import { supabase } from '../supabase'

export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface TimeOffRequest {
  id: string
  staff_id: string
  start_date: string
  end_date: string
  leave_type: string
  reason?: string | null
  status: TimeOffStatus
  manager_note?: string | null
  is_manual_entry?: boolean
  [key: string]: unknown
}

/**
 * Statuses that still hold a staff member off the rota. Everything downstream
 * (useAvailability, generate-rota, the manager calendar, leave balances) filters
 * to these, so moving a request to 'cancelled' frees the staff member up.
 */
export const BLOCKING_STATUSES: TimeOffStatus[] = ['pending', 'approved']

export function isBlocking(status: string): boolean {
  return BLOCKING_STATUSES.includes(status as TimeOffStatus)
}

/** Withdraw a request. `byStaffId` is whoever pressed the button. */
export function cancelTimeOffRequest(id: string, byStaffId?: string | null) {
  return supabase
    .from('time_off_requests')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: byStaffId ?? null })
    .eq('id', id)
}

export function updateTimeOffRequest(id: string, patch: Record<string, unknown>) {
  return supabase.from('time_off_requests').update(patch).eq('id', id)
}

export interface TimeOffPermissions {
  canEdit: boolean
  canCancel: boolean
  /** True when saving changes sends the request back to the manager for approval. */
  needsReapproval: boolean
  /** Why no action is offered, for display. Null when the request is actionable. */
  lockedReason: string | null
}

/**
 * Who may change a request.
 *
 * Managers can edit or withdraw anything. Staff can edit or withdraw their own
 * requests — approved ones included — up until the leave starts, after which it
 * has to go through a manager because the days have already been taken.
 */
export function timeOffPermissions(
  request: TimeOffRequest | null | undefined,
  opts: { staffId?: string | null; isManager?: boolean; today?: string },
): TimeOffPermissions {
  const locked = (lockedReason: string | null): TimeOffPermissions =>
    ({ canEdit: false, canCancel: false, needsReapproval: false, lockedReason })

  if (!request) return locked(null)

  if (!isBlocking(request.status)) {
    return locked(
      request.status === 'cancelled'
        ? 'This request has been withdrawn.'
        : 'This request was rejected — submit a new one if you still need the time off.',
    )
  }

  if (opts.isManager) {
    return { canEdit: true, canCancel: true, needsReapproval: false, lockedReason: null }
  }

  if (!opts.staffId || request.staff_id !== opts.staffId) {
    return locked(null)
  }

  if (request.is_manual_entry) {
    return locked('This leave was logged by a manager — ask them to change it.')
  }

  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  if (request.start_date < today) {
    return locked('This leave has already started — ask a manager to change it.')
  }

  return {
    canEdit: true,
    canCancel: true,
    needsReapproval: request.status === 'approved',
    lockedReason: null,
  }
}
