/**
 * Approve or reject a pending time-off request — the same write and
 * notification the Time off page makes, so a decision taken from the
 * dashboard's Staff Notifications card is recorded identically.
 */
import { supabase } from '../supabase'
import { sendPush } from '../sendPush'

const LEAVE_LABELS = { annual: 'Annual Leave', unpaid: 'Unpaid Leave', other: 'Other' }

export async function decideTimeOff({ request, decision, reviewerId, venueId, note = null }) {
  const approved = decision === 'approved'
  const { error } = await supabase.from('time_off_requests').update({
    status:       decision,
    reviewed_by:  reviewerId,
    reviewed_at:  new Date().toISOString(),
    manager_note: note?.trim() || null,
  })
    .eq('id', request.id)
    .eq('status', 'pending')   // don't overturn a decision made elsewhere meanwhile
  if (error) return { error }

  if (request.staff_id) {
    const label = LEAVE_LABELS[request.leave_type] ?? request.leave_type ?? 'time off'
    sendPush({
      venueId,
      notificationType: 'time_off_decision',
      title: approved ? 'Time Off Approved' : 'Time Off Rejected',
      body:  approved
        ? `Your ${label} (${request.start_date} – ${request.end_date}) has been approved.`
        : `Your time off request (${request.start_date} – ${request.end_date}) was not approved.${note?.trim() ? ' Note: ' + note.trim() : ''}`,
      url:   '/time-off',
      staffIds: [request.staff_id],
    })
  }
  return { error: null }
}
