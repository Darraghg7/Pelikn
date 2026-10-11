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
 * (useAvailability, the rota auto-fill, the manager calendar, leave balances)
 * filters to these, so moving a request to 'cancelled' frees the staff member up.
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

/**
 * A manager saying approved "annual leave" was never paid holiday — the person
 * was just not available to work (zero-hours staff often book it that way).
 * It becomes 'unavailable': still keeps them off the rota on those days, but no
 * longer uses holiday, so any recorded paid hours are cleared.
 *
 * Asks for the rows back: a write the database refuses for a non-manager
 * matches zero rows and would otherwise look like success.
 */
export async function markNotHoliday(ids: string[]): Promise<{ error: { message: string } | null }> {
  if (!ids.length) return { error: null }
  const { data, error } = await supabase
    .from('time_off_requests')
    .update({ leave_type: 'unavailable', paid_hours: null })
    .in('id', ids)
    .select('id')
  if (error) return { error }
  if ((data?.length ?? 0) !== ids.length) return { error: { message: 'Only a manager can change this — some bookings were not changed' } }
  return { error: null }
}

/** Undo markNotHoliday for one booking, putting back the paid hours it had. */
export async function restoreAsHoliday(id: string, paidHours: number | null): Promise<{ error: { message: string } | null }> {
  const { data, error } = await supabase
    .from('time_off_requests')
    .update({ leave_type: 'annual', paid_hours: paidHours })
    .eq('id', id)
    .select('id')
  if (error) return { error }
  if (!data?.length) return { error: { message: 'Only a manager can change this' } }
  return { error: null }
}
