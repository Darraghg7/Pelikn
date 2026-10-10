import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import { LEAVE_TYPES, isOnlyClosedDays } from './timeOffConstants'
import { useAppSettings } from '../../hooks/useSettings'
import Button from '../../components/ui/Button'
import { countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'

/**
 * A manager books leave for someone, approved straight away — past leave, or
 * holiday pay for a week they aren't working. Annual leave carries its holiday
 * hours (once migration 148 is applied): the timesheet pays them in that week
 * and they come off the person's balance.
 *
 * dayHours: the person's usual day (zero-hours average shift), to suggest hours.
 */
export default function ManualLeaveModal({ staff, venueId, managerId, hoursReady, dayHours, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm]     = useState({ startDate: '', endDate: '', leaveType: 'annual', note: '', hours: '' })
  const [saving, setSaving] = useState(false)
  const { closedDays } = useAppSettings()

  const showHours = hoursReady && form.leaveType === 'annual' && form.startDate && form.endDate && form.endDate >= form.startDate
  const suggestedHours = showHours && dayHours != null
    ? Math.round(countWorkingDaysInRequest(form.startDate, form.endDate, staff.working_days) * dayHours * 10) / 10 || null
    : null
  const typedHours = form.hours === '' ? null : parseFloat(form.hours)
  const hours = typedHours ?? suggestedHours
  const hoursInvalid = showHours && typedHours != null && !(typedHours > 0 && typedHours <= 1000)

  const save = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
    if (isOnlyClosedDays(form.startDate, form.endDate, closedDays)) {
      toast("You're closed on these days, so there's nothing to book off", 'error')
      return
    }
    if (hoursInvalid) { toast('Enter the holiday hours to pay', 'error'); return }
    setSaving(true)
    const { error: err } = await supabase.from('time_off_requests').insert({
      staff_id:    staff.id,
      venue_id:    venueId,
      start_date:  form.startDate,
      end_date:    form.endDate,
      leave_type:  form.leaveType,
      status:      'approved',
      reviewed_by: managerId,
      reviewed_at: new Date().toISOString(),
      manager_note: form.note.trim() || 'Added by a manager',
      is_manual_entry: true,
      ...(showHours ? { hours: hours ?? null } : {}),
    })
    setSaving(false)
    if (err) { toast(err.message, 'error'); return }
    toast(`Leave added for ${staff.name}`)
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Add leave — ${staff.name}`}>
      <div className="flex flex-col gap-4">

        {/* Leave type */}
        <div>
          <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">Leave Type</label>
          <div className="flex gap-2 flex-wrap">
            {LEAVE_TYPES.map(t => (
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

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-micro tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value, hours: '' }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
          <div>
            <label className="text-micro tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">End date</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value, hours: '' }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
        </div>

        {/* Holiday hours to pay */}
        {showHours && (
          <label className="flex items-center gap-2.5">
            <span className="flex-1 text-sm text-charcoal dark:text-white">
              Holiday hours to pay
              <span className="block text-xs text-charcoal/50 dark:text-white/40">
                {suggestedHours != null ? 'Their average shift × working days — change it if needed' : 'Leave blank to pay their usual hours'}
              </span>
            </span>
            <input
              type="number" inputMode="decimal" min="0" step="0.25"
              value={form.hours === '' ? (suggestedHours ?? '') : form.hours}
              onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              aria-label="Holiday hours to pay"
              className="w-24 px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-right"
            />
            <span className="text-xs text-charcoal/50 dark:text-white/40">h</span>
          </label>
        )}

        {/* Optional note */}
        <div>
          <label className="text-micro tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">Note (optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="e.g. Summer holiday 2024"
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
        </div>

        <p className="text-caption text-charcoal/35 dark:text-white/30 -mt-2">
          Approved straight away and taken off {staff.name}'s holiday balance. Use it for past leave, or to give holiday pay for a week they aren't working — it's paid on that week's timesheet.
        </p>

        <Button
          fullWidth
          loading={saving}
          onClick={save}
          disabled={saving || !form.startDate || !form.endDate || hoursInvalid}
        >
          {saving ? 'Saving…' : 'Add leave'}
        </Button>
      </div>
    </Modal>
  )
}
