import React, { useMemo, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { addPaidOut } from '../../lib/api/holidayData'
import { useHolidayBalances } from '../../hooks/useHolidayBalances'
import { holidayYearContaining } from '../../lib/holidayYear'

const FIELD_LABEL = 'block text-body-sm font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const FIELD = 'w-full h-12 px-4 rounded-control border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body-lg text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40'

const SHARES = [100, 50, 25]
const h = (n) => `${Math.round(n * 10) / 10} h`

/**
 * Pay someone holiday hours that aren't tied to a booking — the cafe shuts for
 * Christmas week and staff are paid out some of their holiday. Saved as a
 * holiday_paid_out row flagged on_timesheet (migration 154): it is added to
 * that person's pay for the period `paidOn` falls in, and comes off their
 * holiday balance like any other paid-out holiday.
 *
 * `people` are the zero-hours staff who get holiday pay; their holiday is
 * counted in hours, which is what a payout is.
 */
export default function AddHolidayPayModal({
  people, rates, venueId, managerId, periodFrom, periodTo, defaultDate, holidayYearStartMonth,
  initialStaffId = '', onClose, onSaved,
}) {
  const toast = useToast()
  const [staffId, setStaffId] = useState(initialStaffId)
  const [hours, setHours]     = useState('')
  const [paidOn, setPaidOn]   = useState(defaultDate)
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)

  const person = people.find(p => p.id === staffId) ?? null
  const rate   = person ? (rates[person.id] ?? 0) : 0

  // Holiday year of the pay date (a payout in January counts against the year it falls in)
  const holidayYear = useMemo(() => holidayYearContaining(paidOn || defaultDate, holidayYearStartMonth), [paidOn, defaultDate, holidayYearStartMonth])
  const picked = useMemo(() => (person ? [{ ...person, employment_type: 'zero_hours' }] : []), [person])
  const { byId } = useHolidayBalances(picked, holidayYear)
  const holiday  = person ? byId[person.id] : null
  const avgWeek  = holiday?.status === 'ok' ? holiday.avgWeekHours : null
  const left     = holiday?.status === 'ok' ? holiday.balance : null

  const value   = hours.trim() === '' ? null : Number(hours)
  const invalid = value != null && !(value > 0 && value <= 999)
  const dateOk  = !!paidOn && paidOn >= periodFrom && paidOn <= periodTo
  const leftAfter = left != null && value != null && !invalid ? left - value : null

  const save = async () => {
    if (!person) { toast('Choose who to pay', 'error'); return }
    if (value == null || invalid) { toast('Enter the hours to pay', 'error'); return }
    if (!dateOk) { toast('Pick a date inside this timesheet period', 'error'); return }
    setSaving(true)
    const { error } = await addPaidOut({
      venue_id: venueId,
      staff_id: person.id,
      leave_year: holidayYear.startYear,
      hours: Math.round(value * 100) / 100,
      paid_on: paidOn,
      note: note.trim() || null,
      created_by: managerId ?? null,
      on_timesheet: true,
    })
    setSaving(false)
    if (error) {
      toast(error.code === '42703' ? 'This needs the latest database update (migration 154) first' : error.message, 'error')
      return
    }
    toast(`Holiday pay added for ${person.name}`)
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Add holiday pay">
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-ink3 dark:text-white/45">
          Pay holiday hours that aren't a booking — for example when the venue closes over Christmas.
          It is added to their pay for this period and comes off their holiday.
        </p>

        {people.length === 0 ? (
          <p className="text-body-sm text-ink2 dark:text-white/70">
            Nobody here is on a zero-hours contract with holiday pay, so there is nothing to add.
          </p>
        ) : (
          <>
            <label>
              <span className={FIELD_LABEL}>Who</span>
              <select value={staffId} onChange={e => setStaffId(e.target.value)} className={FIELD}>
                <option value="">Choose a person…</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <label>
              <span className={FIELD_LABEL}>Hours to pay</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={hours}
                onChange={e => setHours(e.target.value)}
                className={`${FIELD} font-mono`}
              />
            </label>

            {avgWeek > 0 && (
              <div className="-mt-2">
                <p className="text-body-sm text-ink3 dark:text-white/45 mb-2">Their average week is {h(avgWeek)}. Pay:</p>
                <div className="flex flex-wrap gap-2">
                  {SHARES.map(pct => {
                    const hrs = Math.round(avgWeek * pct) / 100
                    const on = value === hrs
                    return (
                      <Button
                        key={pct}
                        size="sm"
                        variant={on ? 'primary' : 'secondary'}
                        aria-pressed={on}
                        onClick={() => setHours(String(hrs))}
                      >
                        {pct === 100 ? 'A full week' : `${pct}% of a week`} · {h(hrs)}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            <label>
              <span className={FIELD_LABEL}>Date</span>
              <input
                type="date"
                value={paidOn}
                min={periodFrom}
                max={periodTo}
                onChange={e => setPaidOn(e.target.value)}
                className={FIELD}
              />
            </label>

            <label>
              <span className={FIELD_LABEL}>Note (optional)</span>
              <input
                type="text"
                value={note}
                maxLength={200}
                placeholder="Christmas closure"
                onChange={e => setNote(e.target.value)}
                className={FIELD}
              />
            </label>

            <div className="text-body-sm text-ink3 dark:text-white/45 -mt-1 flex flex-col gap-0.5">
              {value != null && !invalid && rate > 0 && (
                <p>
                  Holiday pay <span className="font-mono font-semibold text-ink dark:text-white">£{(value * rate).toFixed(2)}</span> at £{Number(rate).toFixed(2)}/hr
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

            <Button fullWidth loading={saving} onClick={save} disabled={saving || !person || value == null || invalid || !dateOk}>
              {saving ? 'Saving…' : 'Add holiday pay'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
