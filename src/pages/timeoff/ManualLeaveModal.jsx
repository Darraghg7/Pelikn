import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import { leaveTypeChoices } from './timeOffConstants'
import { suggestedPaidHours } from '../../lib/holiday'
import { addPaidOut, removePaidOut, addCarryOver, removeCarryOver } from '../../lib/api/holidayData'
import { previousHolidayYear } from '../../lib/holidayYear'
import { useLastYearLeft } from '../../hooks/useHolidayBalances'
import Button from '../../components/ui/Button'

// min-h-11 + appearance-none: iOS shrinks an empty date input to a sliver.
const INPUT = 'w-full min-h-11 appearance-none px-3 py-2.5 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20'
const LABEL = 'text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1'

const MODES = [['leave', 'Past leave'], ['paid', 'Already paid'], ['carry', 'Carry over']]

/**
 * From the "+" on a team holiday row. Three jobs:
 *   - Past leave: a dated booking that already happened (recorded as approved).
 *   - Holiday already paid: an amount payroll paid with no dates in Pelikn,
 *     e.g. before the venue started tracking here (migration 150). It comes
 *     off the remaining balance and never touches the rota.
 *   - Carry over: unused holiday from last holiday year brought into this one
 *     (migration 153). It adds to the balance.
 *
 * `holidayYear` is the current holiday year (lib/holidayYear).
 */
export default function ManualLeaveModal({ staff, holiday, paidOut = [], carryOver = [], holidayYear, venueId, managerId, onClose, onSaved }) {
  const [mode, setMode] = useState('leave')
  return (
    <Modal open onClose={onClose} title={staff.name}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="What are you recording?">
          {MODES.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={mode === value ? 'primary' : 'secondary'}
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className="w-full px-2"
            >
              {label}
            </Button>
          ))}
        </div>
        {mode === 'leave' && <PastLeaveForm staff={staff} holiday={holiday} venueId={venueId} managerId={managerId} onClose={onClose} onSaved={onSaved} />}
        {mode === 'paid'  && <PaidOutForm staff={staff} paidOut={paidOut} holidayYear={holidayYear} venueId={venueId} managerId={managerId} onSaved={onSaved} />}
        {mode === 'carry' && <CarryOverForm staff={staff} carryOver={carryOver} holidayYear={holidayYear} venueId={venueId} managerId={managerId} onSaved={onSaved} />}
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
      <p className="text-caption text-charcoal/50 dark:text-white/45 -mt-1">
        Time off {staff.name} has already taken, on dates you know — for example a week away before you started using Pelikn. It's saved as approved leave on those dates. Use Already paid instead if you only know how much holiday payroll has paid, not when it was taken.
      </p>

      {/* Leave type */}
      <div>
        <p className={LABEL}>Leave type</p>
        <div className="flex gap-2 flex-wrap">
          {leaveTypeChoices({ isManager: true }).map(t => (
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
          <label htmlFor="manual-start-date" className={LABEL}>Start date</label>
          <input
            id="manual-start-date"
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="manual-end-date" className={LABEL}>End date</label>
          <input
            id="manual-end-date"
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            className={INPUT}
          />
        </div>
      </div>

      {asksForHours && (
        <div>
          <label htmlFor="manual-paid-hours" className={LABEL}>Holiday hours paid</label>
          <input
            id="manual-paid-hours"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={hoursText}
            onChange={e => setForm(f => ({ ...f, paidHours: e.target.value }))}
            placeholder="e.g. 12"
            className={INPUT}
          />
          {suggested != null && (
            <p className="text-caption text-charcoal/45 dark:text-white/40 mt-1">About {suggested} h from their average week. Change it to what payroll actually paid.</p>
          )}
        </div>
      )}

      {/* Optional note */}
      <div>
        <label htmlFor="manual-note" className={LABEL}>Note (optional)</label>
        <input
          id="manual-note"
          type="text"
          value={form.note}
          onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="e.g. Summer holiday"
          className={INPUT}
        />
      </div>

      {form.leaveType && (
        <p className="text-caption text-charcoal/50 dark:text-white/45">
          {form.leaveType === 'annual'
            ? `Counted against ${staff.name}'s holiday.`
            : `Doesn't use ${staff.name}'s holiday.`}
        </p>
      )}

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

function PaidOutForm({ staff, paidOut, holidayYear, venueId, managerId, onSaved }) {
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
      leave_year: holidayYear.startYear,
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
        Holiday pay {staff.name} has already had in {holidayYear.label} with no dates in Pelikn — for example paid through payroll before you tracked holiday here, or paid out instead of taken. Just enter the amount; it comes off their holiday left. If you know the dates they were off, use Past leave instead.
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
          <p className={LABEL}>Already recorded for {holidayYear.label}</p>
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

/**
 * Carry unused holiday from last holiday year into this one. One amount per
 * person per year (153's unique constraint): to change it, remove it and add
 * the new figure. Suggests what they had left at the end of last year.
 */
function CarryOverForm({ staff, carryOver, holidayYear, venueId, managerId, onSaved }) {
  const toast = useToast()
  const inHours = staff.employment_type === 'zero_hours'
  const unit = inHours ? 'hours' : 'days'
  const lastYear = previousHolidayYear(holidayYear)
  const existing = carryOver[0] ?? null
  const left = useLastYearLeft(staff, holidayYear, !existing)
  const suggested = left ? (inHours ? left.hours : left.days) : null

  const [typed, setAmount]  = useState(null)   // null until the manager types: shows the suggestion
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  const amount = typed ?? (suggested ? String(suggested) : '')
  const value = amount.trim() === '' ? null : Number(amount)
  const valid = value != null && value > 0 && value <= (inHours ? 999 : 99)

  const save = async () => {
    if (!valid) { toast(`Enter the ${unit} to carry over`, 'error'); return }
    setSaving(true)
    const { error } = await addCarryOver({
      venue_id:   venueId,
      staff_id:   staff.id,
      leave_year: holidayYear.startYear,
      [unit]:     inHours ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10,
      note:       note.trim() || null,
      created_by: managerId ?? null,
    })
    setSaving(false)
    if (error) {
      toast(
        error.code === 'PGRST205' ? 'This needs a database update (migration 153) before it can be saved'
          : error.code === '23505' ? 'Holiday has already been carried over for this year — remove it first to change it'
            : error.message,
        'error',
      )
      return
    }
    toast(`Carried over for ${staff.name}`)
    setAmount(null); setNote('')
    onSaved()
  }

  const remove = async () => {
    setRemoving(true)
    const { error } = await removeCarryOver(existing.id)
    setRemoving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Removed')
    onSaved()
  }

  if (existing) {
    const amountText = existing.hours != null
      ? `${Number(existing.hours)} h`
      : `${Number(existing.days)} ${Number(existing.days) === 1 ? 'day' : 'days'}`
    return (
      <>
        <p className="text-caption text-charcoal/50 dark:text-white/45 -mt-1">
          Carried over from {lastYear.label} into {holidayYear.label}. It's added to {staff.name}'s holiday left.
        </p>
        <div className="flex items-center gap-2.5">
          <div className="flex-1 min-w-0 text-sm text-charcoal dark:text-white">
            <span className="font-mono font-semibold">{amountText}</span>
            <span className="text-charcoal/50 dark:text-white/45">
              {' '}· {existing.creator?.name ? `by ${existing.creator.name}, ` : ''}{format(parseISO(existing.created_at), 'd MMM yyyy')}
            </span>
            {existing.note && <span className="block text-caption text-charcoal/50 dark:text-white/45 truncate">{existing.note}</span>}
          </div>
          <Button variant="danger-ghost" size="sm" loading={removing} onClick={remove}>Remove</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="text-caption text-charcoal/50 dark:text-white/45 -mt-1">
        Unused holiday from {lastYear.label} that {staff.name} can still take in {holidayYear.label}. It's added to their holiday left.
      </p>

      <div>
        <label htmlFor="carry-over-amount" className={LABEL}>{inHours ? 'Hours to carry over' : 'Days to carry over'}</label>
        <input
          id="carry-over-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={inHours ? 'e.g. 8' : 'e.g. 2'}
          className={INPUT}
        />
        {left && (
          <p className="text-caption text-charcoal/45 dark:text-white/40 mt-1">
            {suggested
              ? `${inHours ? `${suggested} h` : `${suggested} ${suggested === 1 ? 'day' : 'days'}`} left at the end of ${lastYear.label}. Change it if you're carrying over less.`
              : `Nothing was left at the end of ${lastYear.label}.`}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="carry-over-note" className={LABEL}>Note (optional)</label>
        <input
          id="carry-over-note"
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Agreed in their review"
          className={INPUT}
        />
      </div>

      <Button fullWidth loading={saving} onClick={save} disabled={saving || !valid}>
        {saving ? 'Saving…' : 'Carry over'}
      </Button>
    </>
  )
}
