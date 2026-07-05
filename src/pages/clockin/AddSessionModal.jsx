import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import { londonWallTimeToInstant } from '../../lib/time'

export default function AddSessionModal({ open, onClose, staffList, initialStaffId, initialDate, venueId, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    staffId: '', date: '', clockIn: '', clockOut: '',
    breakEnabled: false, breakStart: '', breakEnd: '',
  })
  const [saving, setSaving] = useState(false)

  // Reset whenever the modal opens with new target
  useEffect(() => {
    if (open) setForm({ staffId: initialStaffId, date: initialDate, clockIn: '', clockOut: '', breakEnabled: false, breakStart: '', breakEnd: '' })
  }, [open, initialStaffId, initialDate])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const { staffId, date, clockIn, clockOut, breakEnabled, breakStart, breakEnd } = form
    if (!staffId)          { toast('Please select a staff member', 'error'); return }
    if (!date)             { toast('Please select a date', 'error'); return }
    if (!clockIn || !clockOut) { toast('Clock in and clock out are required', 'error'); return }
    if (clockOut <= clockIn)   { toast('Clock out must be after clock in', 'error'); return }
    if (breakEnabled) {
      if (!breakStart || !breakEnd)                             { toast('Fill in both break times', 'error'); return }
      if (breakStart <= clockIn || breakEnd <= breakStart || breakEnd >= clockOut) {
        toast('Break times must fall within the shift', 'error'); return
      }
    }

    // Interpret entered times as UK wall-clock (Europe/London); store UTC.
    const toISO = (t) => londonWallTimeToInstant(date, t).toISOString()
    const events = [
      { staff_id: staffId, event_type: 'clock_in',  occurred_at: toISO(clockIn),  venue_id: venueId },
    ]
    if (breakEnabled && breakStart && breakEnd) {
      events.push({ staff_id: staffId, event_type: 'break_start', occurred_at: toISO(breakStart), venue_id: venueId })
      events.push({ staff_id: staffId, event_type: 'break_end',   occurred_at: toISO(breakEnd),   venue_id: venueId })
    }
    events.push({ staff_id: staffId, event_type: 'clock_out', occurred_at: toISO(clockOut), venue_id: venueId })

    setSaving(true)
    const { error } = await supabase.from('clock_events').insert(events)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Session added')
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Session">
      <div className="flex flex-col gap-4">

        {/* Staff */}
        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Staff Member</label>
          <select
            value={form.staffId}
            onChange={e => set('staffId', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          >
            <option value="">Select staff…</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>

        {/* Clock in / out */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Clock In</label>
            <input
              type="time"
              value={form.clockIn}
              onChange={e => set('clockIn', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Clock Out</label>
            <input
              type="time"
              value={form.clockOut}
              onChange={e => set('clockOut', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
        </div>

        {/* Break toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.breakEnabled}
            onChange={e => set('breakEnabled', e.target.checked)}
            className="rounded accent-charcoal"
          />
          <span className="text-sm text-charcoal/70">Include a break</span>
        </label>

        {/* Break times */}
        {form.breakEnabled && (
          <div className="grid grid-cols-2 gap-3 pl-7">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Break Start</label>
              <input
                type="time"
                value={form.breakStart}
                onChange={e => set('breakStart', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Break End</label>
              <input
                type="time"
                value={form.breakEnd}
                onChange={e => set('breakEnd', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40 mt-1"
        >
          {saving ? 'Saving…' : 'Add Session →'}
        </button>
      </div>
    </Modal>
  )
}
