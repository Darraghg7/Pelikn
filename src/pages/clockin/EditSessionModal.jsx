import React, { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'

const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90]

function snapToBreakOption(mins) {
  return BREAK_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - mins) < Math.abs(prev - mins) ? curr : prev
  )
}

export default function EditSessionModal({ open, onClose, session, venueId, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ clockIn: '', clockOut: '' })
  const [breakMin, setBreakMin] = useState('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && session) {
      setForm({
        clockIn:  session.in  ? format(parseISO(session.in),  'HH:mm') : '',
        clockOut: session.out ? format(parseISO(session.out), 'HH:mm') : '',
      })
      const existingBreakMins = (session.breaks ?? []).reduce((acc, b) => {
        if (!b.start || !b.end) return acc
        return acc + Math.round((new Date(b.end) - new Date(b.start)) / 60000)
      }, 0)
      setBreakMin(String(snapToBreakOption(existingBreakMins)))
    }
  }, [open, session])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const { clockIn, clockOut } = form
    if (!clockIn || !clockOut) { toast('Both clock in and clock out are required', 'error'); return }
    if (clockOut <= clockIn)   { toast('Clock out must be after clock in', 'error'); return }

    const date  = session.in.slice(0, 10)
    const toISO = (t) => new Date(`${date}T${t}:00`).toISOString()

    setSaving(true)
    const { error } = await supabase.rpc('edit_clock_session', {
      p_clock_in_id:    session.inId,
      p_clock_in_time:  toISO(clockIn),
      p_clock_out_id:   session.outId ?? null,
      p_clock_out_time: toISO(clockOut),
      p_break_minutes:  parseInt(breakMin, 10) || 0,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Session updated')
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Session">
      <div className="flex flex-col gap-4">
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
        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Break</label>
          <select
            value={breakMin}
            onChange={e => setBreakMin(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          >
            {BREAK_OPTIONS.map(m => (
              <option key={m} value={String(m)}>{m === 0 ? 'No break' : `${m} min`}</option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40 mt-1"
        >
          {saving ? 'Saving…' : 'Save Changes →'}
        </button>
      </div>
    </Modal>
  )
}
