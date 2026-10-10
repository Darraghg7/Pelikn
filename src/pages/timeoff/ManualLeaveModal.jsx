import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import { LEAVE_TYPES } from './timeOffConstants'
import { suggestedPaidHours } from '../../lib/holiday'
import { addPaidOut, removePaidOut } from '../../lib/api/holidayData'
import Button from '../../components/ui/Button'

const INPUT = 'w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20'
const LABEL = 'text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1'

/**
 * From the "+" on a team holiday row. Two jobs:
 *   - Past leave: a dated booking that already happened (recorded as approved).
 *   - Holiday already paid: an amount payroll paid with no dates in Pelikn,
 *     e.g. before the venue started tracking here (migration 150). It comes
 *     off the remaining balance and never touches the rota.
 */
export default function ManualLeaveModal({ staff, holiday, paidOut = [], year, venueId, managerId, onClose, onSaved }) {
  const [mode, setMode] = useState('leave')
  return (
    <Modal open onClose={onClose} title={staff.name}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2" role="radiogroup" aria-label="What are you recording?">
          {[['leave', 'Past leave'], ['paid', 'Holiday already paid']].map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={mode === value ? 'primary' : 'secondary'}
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {mode === 'leave'
          ? <PastLeaveForm staff={staff} holiday={holiday} venueId={venueId} managerId={managerId} onClose={onClose} onSaved={onSaved} />
          : <PaidOutForm staff={staff} paidOut={paidOut} year={year} venueId={venueId} managerId={managerId} onSaved={onSaved} />}
      </div>
    </Modal>
  )
}

function PastLeaveForm({ staff, holiday, venueId, managerId, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm]     = useState({ startDate: '', endDate: '', leaveType: '', note: '', paidHours: null })
  const [saving, setSaving] = useState(false)

  // Zero-hours annual leave is paid in hours: suggest from their average week, let the manager correct it.
  const asksForHours = form.leaveType === 'annual' && staff.employment_type === 'zero_hours'
  const suggested = asksForHours && form.startDate && form.endDate >= form.startDate && holiday?.status === 'ok'
    ? suggestedPaidHours({ start_date: form.startDate, end_date: form.endDate }, holiday.avgWeekHours, staff.working_days)
    : null
  const hoursText = form.paidHours ?? (suggested != null ? String(suggested) : '')

  const save = async () => {
    if (!form.leaveType) { toast('Choose what kind of time off this was', 'error'); return }
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
    if (asksForHours && hoursText.trim() !== '' && !(Number(hoursText) >= 0)) { toast('Enter the holiday hours paid as a number', 'error'); return }
    setSaving(true)
    const row = {
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
    }
    if (asksForHours && hoursText.trim() !== '') row.paid_hours = Math.round(Number(hoursText) * 100) / 100
    let { error: err } = await supabase.from('time_off_requests').insert(row)
    // Before migration 149 there is no paid_hours column — log it without.
    if (err && row.paid_hours != null && (err.code === 'PGRST204' || err.code === '42703')) {
      delete row.paid_hours
      ;({ error: err } = await supabase.from('time_off_requests').insert(row))
    }
    setSaving(false)
    if (err) { toast(err.message, 'error'); return }
    toast(`Past leave logged for ${staff.name}`)
    onSaved()
    onClose()
  }

  return (
    <>
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
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
        </div>
        <div>
          <label className="text-micro tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">End date</label>
          <input
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
        </div>
      </div>

      {asksForHours && (
        <div>
          <label htmlFor="manual-paid-hours" className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Holiday hours paid</label>
          <input
            id="manual-paid-hours"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={hoursText}
            onChange={e => setForm(f => ({ ...f, paidHours: e.target.value }))}
            placeholder="e.g. 12"
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
          {suggested != null && (
            <p className="text-caption text-charcoal/45 dark:text-white/40 mt-1">About {suggested} h from their average week. Change it to what payroll actually paid.</p>
          )}
        </div>
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
        {form.leaveType === 'annual'
          ? `This will be recorded as approved leave and counted against ${staff.name}'s holiday.`
          : `This will be recorded as approved time off. It doesn't use ${staff.name}'s holiday.`}
      </p>

      <Button
        fullWidth
        loading={saving}
        onClick={save}
        disabled={saving || !form.leaveType || !form.startDate || !form.endDate}
      >
        {saving ? 'Saving…' : 'Log Leave'}
      </Button>
    </>
  )
}

function PaidOutForm({ staff, paidOut, year, venueId, managerId, onSaved }) {
  const toast = useToast()
  const inHours = staff.employment_type === 'zero_hours'
  const unit = inHours ? 'hours' : 'days'
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState('')
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(null)

  const value = amount.trim() === '' ? null : Number(amount)
  const valid = value != null && value > 0 && value <= (inHours ? 999 : 99)

  const save = async () => {
    if (!valid) { toast(`Enter the ${unit} of holiday already paid`, 'error'); return }
    setSaving(true)
    const { error } = await addPaidOut({
      venue_id:   venueId,
      staff_id:   staff.id,
      leave_year: year,
      [unit]:     inHours ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10,
      paid_on:    paidOn || null,
      note:       note.trim() || null,
      created_by: managerId ?? null,
    })
    setSaving(false)
    if (error) {
      toast(error.code === 'PGRST205' ? 'This needs a database update (migration 150) before it can be saved' : error.message, 'error')
      return
    }
    toast(`Recorded for ${staff.name}`)
    setAmount(''); setPaidOn(''); setNote('')
    onSaved()
  }

  const remove = async (id) => {
    setRemoving(id)
    const { error } = await removePaidOut(id)
    setRemoving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Removed')
    onSaved()
  }

  return (
    <>
      <p className="text-caption text-charcoal/50 dark:text-white/45 -mt-1">
        Holiday {staff.name} has already been paid for in {year} that isn't booked in Pelikn — for example, paid through payroll before you started tracking holiday here. It comes off their remaining balance.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="paid-out-amount" className={LABEL}>{inHours ? 'Hours paid' : 'Days paid'}</label>
          <input
            id="paid-out-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={inHours ? 'e.g. 20' : 'e.g. 3'}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="paid-out-date" className={LABEL}>Paid on (optional)</label>
          <input id="paid-out-date" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} className={INPUT} />
        </div>
      </div>

      <div>
        <label htmlFor="paid-out-note" className={LABEL}>Note (optional)</label>
        <input
          id="paid-out-note"
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Paid in July payroll"
          className={INPUT}
        />
      </div>

      <Button fullWidth loading={saving} onClick={save} disabled={saving || !valid}>
        {saving ? 'Saving…' : 'Record holiday already paid'}
      </Button>

      {paidOut.length > 0 && (
        <div className="border-t border-charcoal/10 dark:border-white/10 pt-3">
          <p className={LABEL}>Already recorded for {year}</p>
          <div className="flex flex-col gap-2 mt-1">
            {paidOut.map(p => (
              <div key={p.id} className="flex items-center gap-2.5">
                <div className="flex-1 min-w-0 text-sm text-charcoal dark:text-white">
                  <span className="font-mono font-semibold">{p.hours != null ? `${Number(p.hours)} h` : `${Number(p.days)} ${Number(p.days) === 1 ? 'day' : 'days'}`}</span>
                  {p.paid_on && <span className="text-charcoal/50 dark:text-white/45"> · paid {format(parseISO(p.paid_on), 'd MMM yyyy')}</span>}
                  {p.note && <span className="block text-caption text-charcoal/50 dark:text-white/45 truncate">{p.note}</span>}
                </div>
                <Button variant="danger-ghost" size="sm" loading={removing === p.id} onClick={() => remove(p.id)}>Remove</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
