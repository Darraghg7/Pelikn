import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { leaveHoursBreakdown, estimateLeaveHours } from '../../lib/holiday'

const FIELD_LABEL = 'block text-body-sm font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const TEXT_FIELD  = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body-lg text-ink dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40'

const h = (n) => `${Math.round(n * 10) / 10} h`

function dates(r) {
  const s = parseISO(r.start_date), e = parseISO(r.end_date)
  if (r.start_date === r.end_date) return format(s, 'EEE d MMM')
  return `${format(s, 'EEE d MMM')} – ${format(e, 'EEE d MMM')}`
}

/**
 * Confirm the holiday hours a zero-hours worker is paid for one booking.
 * Opened from the timesheet for the week the holiday falls in. Saves
 * time_off_requests.paid_hours, which the timesheet's holiday pay and the
 * person's holiday balance both read.
 */
export default function HolidayPayModal({
  request, staffName, hourlyRate, workingDays, avgWeekHours, rotaHoursByDate, holidayLeft,
  periodFrom, periodTo, locked, onClose, onSaved,
}) {
  const toast = useToast()
  const breakdown = leaveHoursBreakdown(request, avgWeekHours, workingDays, rotaHoursByDate)
  const initial = request.paid_hours != null ? String(request.paid_hours) : breakdown ? String(breakdown.hours) : ''
  const [hours, setHours]   = useState(initial)
  const [saving, setSaving] = useState(false)

  const value   = hours.trim() === '' ? null : Number(hours)
  const invalid = value != null && !(value >= 0 && value <= 999)
  const spills  = request.start_date < periodFrom || request.end_date > periodTo
  // holidayLeft already takes this booking off, at its recorded hours or (if
  // none) the plain average-week estimate — swap that for what's typed here.
  const countedNow = request.paid_hours != null
    ? Number(request.paid_hours)
    : estimateLeaveHours(request.start_date, request.end_date, avgWeekHours, workingDays)
  const leftAfter = holidayLeft != null && value != null && !invalid ? holidayLeft + countedNow - value : null

  const save = async () => {
    if (value == null || invalid) { toast('Enter the hours to pay', 'error'); return }
    setSaving(true)
    const { error } = await supabase
      .from('time_off_requests')
      .update({ paid_hours: Math.round(value * 100) / 100 })
      .eq('id', request.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Holiday pay saved for ${staffName}`)
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Holiday pay — ${staffName}`}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-body-lg font-semibold text-ink dark:text-white">{dates(request)}</p>
          <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">Annual leave, approved</p>
          {spills && (
            <p className="text-body-sm text-ink2 dark:text-white/70 mt-1.5">
              This booking runs outside this timesheet period. Enter the hours for the whole booking — each week gets its share.
            </p>
          )}
        </div>

        {breakdown ? (
          <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 text-body-sm text-ink2 dark:text-white/70 flex flex-col gap-1">
            <p className="font-semibold text-ink dark:text-white">Suggested: {h(breakdown.hours)}</p>
            {breakdown.rotaDays > 0 && (
              <p>{h(breakdown.rotaHours)} from the rota — {breakdown.rotaDays === 1 ? 'the shift' : `${breakdown.rotaDays} shifts`} they were booked on</p>
            )}
            {breakdown.averageDays > 0 && (
              <p>
                {h(breakdown.averageHours)} from their average week ({h(avgWeekHours)})
                {' '}for {breakdown.averageDays === 1 ? 'one other day' : `${breakdown.averageDays} ${breakdown.rotaDays ? 'other ' : ''}days`}
              </p>
            )}
            {breakdown.hours === 0 && <p>None of these days are days they usually work.</p>}
          </div>
        ) : (
          <p className="text-body-sm text-ink3 dark:text-white/45">
            No rota shifts or worked weeks to suggest from — enter what payroll is paying.
          </p>
        )}

        <label>
          <span className={FIELD_LABEL}>Hours to pay</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={hours}
            onChange={e => setHours(e.target.value)}
            disabled={locked}
            className={TEXT_FIELD}
          />
        </label>

        <div className="text-body-sm text-ink3 dark:text-white/45 -mt-2 flex flex-col gap-0.5">
          {value != null && !invalid && hourlyRate > 0 && (
            <p>
              Holiday pay <span className="font-mono font-semibold text-ink dark:text-white">£{(value * hourlyRate).toFixed(2)}</span> at £{Number(hourlyRate).toFixed(2)}/hr
            </p>
          )}
          {leftAfter != null && (
            <p className={leftAfter < 0 ? 'font-semibold text-warn dark:text-warnDark' : ''}>
              {leftAfter < 0
                ? `That's ${h(-leftAfter)} more holiday than they've built up this year`
                : `${h(leftAfter)} of holiday left this year after this`}
            </p>
          )}
        </div>

        {locked ? (
          <p className="text-body-sm font-semibold text-warn dark:text-warnDark">
            This period is locked for payroll. Unlock it to change holiday pay.
          </p>
        ) : (
          <Button fullWidth loading={saving} onClick={save} disabled={saving || value == null || invalid}>
            {saving ? 'Saving…' : 'Save holiday pay'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
