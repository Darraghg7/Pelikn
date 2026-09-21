import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import { LEAVE_TYPES } from './timeOffConstants'

export default function ManualLeaveModal({ staff, venueId, managerId, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm]     = useState({ startDate: '', endDate: '', leaveType: 'annual', note: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
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
      manager_note: form.note.trim() || 'Manually logged — pre-app record',
      is_manual_entry: true,
    })
    setSaving(false)
    if (err) { toast(err.message, 'error'); return }
    toast(`Past leave logged for ${staff.name}`)
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Log past leave — ${staff.name}`}>
      <div className="flex flex-col gap-4">

        {/* Leave type */}
        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">Leave Type</label>
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
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">End date</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
        </div>

        {/* Optional note */}
        <div>
          <label className="text-[11px] tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">Note (optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="e.g. Summer holiday 2024"
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
        </div>

        <p className="text-[11px] text-charcoal/35 dark:text-white/30 -mt-2">
          This will be recorded as approved leave and counted against {staff.name}'s annual balance.
        </p>

        <button
          onClick={save}
          disabled={saving || !form.startDate || !form.endDate}
          className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Log Leave'}
        </button>
      </div>
    </Modal>
  )
}
