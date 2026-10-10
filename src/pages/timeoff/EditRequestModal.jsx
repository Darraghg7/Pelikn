import React, { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { sendPush } from '../../lib/sendPush'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { cancelTimeOffRequest, updateTimeOffRequest, timeOffPermissions } from '../../lib/api/timeOff'
import { requestableLeaveTypes, STATUS_COLOURS, leaveTypeLabel, fmtDays, isOnlyClosedDays } from './timeOffConstants'
import Button from '../../components/ui/Button'

/**
 * Opened from a calendar day or the "My Requests" list. Staff manage their own
 * booked time off here; managers can manage anyone's. Withdrawing sets the
 * request to 'cancelled', which is what frees the staff member up on the rota.
 */
// hoursReady: migration 148 is applied, so annual leave carries its holiday hours.
// dayHours: the person's usual day (zero-hours average shift), to re-suggest
// hours when the dates change; null when unknown.
export default function EditRequestModal({ request, isManager, actorId, actorName, venueId, closedDays, allowUnpaidLeave, checkBalance, hoursReady, dayHours, onClose, onSaved }) {
  const toast = useToast()
  const perms = timeOffPermissions(request, { staffId: actorId, isManager })

  const [form, setForm] = useState({
    startDate: request.start_date,
    endDate:   request.end_date,
    leaveType: request.leave_type,
    reason:    request.reason ?? '',
    hours:     request.hours != null ? String(Number(request.hours)) : '',
  })
  const [saving, setSaving]     = useState(false)
  const [confirming, setConfirm] = useState(false)

  const isOwn   = request.staff_id === actorId
  const changed =
    form.startDate !== request.start_date ||
    form.endDate   !== request.end_date   ||
    form.leaveType !== request.leave_type ||
    form.reason    !== (request.reason ?? '') ||
    form.hours     !== (request.hours != null ? String(Number(request.hours)) : '')

  const days = useMemo(
    () => (form.leaveType === 'annual' && form.startDate && form.endDate
      ? countWorkingDaysInRequest(form.startDate, form.endDate, request.staff?.working_days)
      : null),
    [form.startDate, form.endDate, form.leaveType, request.staff?.working_days],
  )

  // Holiday hours: what's typed, else working days × their usual day
  const showHours      = hoursReady && form.leaveType === 'annual'
  const suggestedHours = days != null && dayHours != null ? Math.round(days * dayHours * 10) / 10 : null
  const typedHours     = form.hours === '' ? null : parseFloat(form.hours)
  const hours          = typedHours ?? suggestedHours

  // The same rules as a new request — only checked once the dates change, so
  // an existing booking can still be withdrawn or have its reason edited.
  const datesChanged = form.startDate !== request.start_date || form.endDate !== request.end_date || form.leaveType !== request.leave_type ||
    form.hours !== (request.hours != null ? String(Number(request.hours)) : '')
  const problem = useMemo(() => {
    if (!datesChanged || !form.startDate || !form.endDate || form.endDate < form.startDate) return null
    if (isOnlyClosedDays(form.startDate, form.endDate, closedDays)) {
      return "We're closed on these days, so there's nothing to book off."
    }
    if (days === 0) {
      return "None of these days are working days, so they don't use holiday. If that's wrong, check the working days on their staff profile."
    }
    if (typedHours != null && !(typedHours > 0 && typedHours <= 1000)) return 'Enter the holiday hours for this booking.'
    return checkBalance?.(days, hours) ?? null
  }, [datesChanged, form.startDate, form.endDate, closedDays, days, typedHours, hours, checkBalance])

  // A staff member changing leave a manager already approved sends it back to pending.
  const willNeedReapproval = perms.needsReapproval && changed

  // Keep the other side of the request in the loop: managers need to know the
  // rota has changed, staff need to know a manager touched their booking.
  const notify = (action, patch) => {
    const range = patch
      ? `${patch.start_date} – ${patch.end_date}`
      : `${request.start_date} – ${request.end_date}`

    if (isOwn) {
      sendPush({
        venueId,
        notificationType: 'time_off_request',
        title: action === 'withdrawn' ? 'Leave Request Withdrawn' : 'Leave Request Updated',
        body: action === 'withdrawn'
          ? `${actorName ?? 'A staff member'} withdrew their ${leaveTypeLabel(request.leave_type)} (${range}) — they are free for the rota again.`
          : `${actorName ?? 'A staff member'} changed their ${leaveTypeLabel(patch?.leave_type ?? request.leave_type)} to ${range}.`,
        url: '/time-off',
        roles: ['manager', 'owner'],
      })
    } else if (request.staff_id) {
      sendPush({
        venueId,
        notificationType: 'time_off_decision',
        title: action === 'withdrawn' ? 'Time Off Removed' : 'Time Off Changed',
        body: action === 'withdrawn'
          ? `Your time off (${range}) was removed by a manager.`
          : `Your time off was changed to ${range}.`,
        url: '/time-off',
        staffIds: [request.staff_id],
      })
    }
  }

  const save = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
    if (problem)                          { toast(problem, 'error'); return }

    /** @type {Record<string, any>} */
    const patch = {
      start_date: form.startDate,
      end_date:   form.endDate,
      leave_type: form.leaveType,
      reason:     form.reason.trim() || null,
      ...(hoursReady ? { hours: form.leaveType === 'annual' ? hours ?? null : null } : {}),
    }
    if (willNeedReapproval) {
      patch.status       = 'pending'
      patch.reviewed_by  = null
      patch.reviewed_at  = null
      patch.manager_note = null
    }

    setSaving(true)
    const { error: err } = await updateTimeOffRequest(request.id, patch)
    setSaving(false)
    if (err) { toast(err.message, 'error'); return }

    toast(willNeedReapproval ? 'Updated — sent back to your manager for approval' : 'Time off updated')
    notify('updated', patch)
    onSaved()
    onClose()
  }

  const withdraw = async () => {
    setSaving(true)
    const { error: err } = await cancelTimeOffRequest(request.id, actorId)
    setSaving(false)
    setConfirm(false)
    if (err) { toast(err.message, 'error'); return }

    toast(request.status === 'approved' ? 'Time off removed' : 'Request withdrawn')
    notify('withdrawn')
    onSaved()
    onClose()
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={isOwn ? 'Your time off' : `${request.staff?.name ?? 'Staff'} — time off`}
      >
        <div className="flex flex-col gap-4">

          {/* Current status */}
          <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between ${STATUS_COLOURS[request.status]}`}>
            <span className="text-xs font-medium">
              {format(parseISO(request.start_date), 'd MMM')} — {format(parseISO(request.end_date), 'd MMM yyyy')}
            </span>
            <span className="text-micro tracking-wider uppercase font-semibold">{request.status}</span>
          </div>

          {perms.lockedReason && (
            <p className="text-xs text-charcoal/45 dark:text-white/40">{perms.lockedReason}</p>
          )}

          {!perms.canEdit && !perms.lockedReason && (
            <p className="text-xs text-charcoal/45 dark:text-white/40">Only {request.staff?.name ?? 'this staff member'} or a manager can change this.</p>
          )}

          {perms.canEdit && (
            <>
              {/* Leave type */}
              <div>
                <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">Leave Type</label>
                <div className="flex gap-2 flex-wrap">
                  {requestableLeaveTypes({ allowUnpaidLeave, isManager, current: request.leave_type }).map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        form.leaveType === t.value
                          ? 'bg-charcoal text-cream border-charcoal dark:border-white'
                          : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15',
                      ].join(' ')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({
                      ...f,
                      startDate: e.target.value,
                      endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
                      hours: '',
                    }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">End date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value, hours: '' }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                  />
                </div>
              </div>

              {days != null && days > 0 && (
                <p className="text-xs text-charcoal/50 dark:text-white/40 -mt-2">
                  Covers <span className="font-semibold text-charcoal dark:text-white">{fmtDays(days)}</span> of working days.
                </p>
              )}

              {showHours && (
                <label className="flex items-center gap-2.5">
                  <span className="flex-1 text-sm text-charcoal dark:text-white">
                    Holiday hours
                    {hours == null && <span className="block text-xs text-charcoal/50 dark:text-white/40">Leave blank to use the usual hours</span>}
                  </span>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.25"
                    value={form.hours === '' ? (suggestedHours ?? '') : form.hours}
                    onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                    aria-label="Holiday hours"
                    className="w-24 px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-right"
                  />
                  <span className="text-xs text-charcoal/50 dark:text-white/40">h</span>
                </label>
              )}

              {/* Reason */}
              <div>
                <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Reason (optional)</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                />
              </div>

              {willNeedReapproval && (
                <div className="rounded-xl bg-warning/8 border border-warning/20 px-4 py-2.5">
                  <p className="text-caption text-warning font-medium">
                    This leave is already approved — saving changes sends it back to your manager for approval.
                  </p>
                </div>
              )}

              {problem && (
                <p role="alert" className="rounded-xl bg-badBg dark:bg-bad/20 px-4 py-2.5 text-caption font-semibold text-bad dark:text-badDark">
                  {problem}
                </p>
              )}

              <Button
                loading={saving}
                onClick={save}
                disabled={saving || !changed || !!problem}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          )}

          {perms.canCancel && (
            <Button
              variant="danger-ghost"
              onClick={() => setConfirm(true)}
              disabled={saving}
            >
              {request.status === 'approved' ? 'Remove this time off' : 'Withdraw request'}
            </Button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming}
        title={request.status === 'approved' ? 'Remove this time off?' : 'Withdraw this request?'}
        message={
          request.status === 'approved'
            ? `${isOwn ? 'You' : request.staff?.name ?? 'This staff member'} will be available for shifts on these days again${request.leave_type === 'annual' ? ', and the days go back into the annual leave balance' : ''}.`
            : 'The request will be removed from the calendar and your manager will no longer see it.'
        }
        confirmLabel={request.status === 'approved' ? 'Remove' : 'Withdraw'}
        danger
        onConfirm={withdraw}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
