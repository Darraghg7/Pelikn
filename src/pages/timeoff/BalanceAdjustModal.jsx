import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import {
  addBalanceAdjustment, removeBalanceAdjustment, holidayHoursUsed, zeroHoursLeft,
} from '../../lib/api/holidayPay'

const FIELD = 'w-full h-11 px-3.5 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body text-ink dark:text-white'
const LABEL = 'block text-body-sm font-semibold text-ink3 dark:text-white/50 mb-1.5'
const KINDS = [
  { value: 'carry_over', label: 'Carry over' },
  { value: 'payout',     label: 'Pay out' },
]

/**
 * A manager adds hours to a zero-hours person's holiday balance (carried over
 * from last holiday year) or pays unused hours out as money. A pay-out is
 * taken off the balance and paid on the timesheet for the period containing
 * its pay date.
 *
 * balance: their row from useTeamLeaveBalances
 * accrual: { accrued, avgDailyHours } for this holiday year
 */
export default function BalanceAdjustModal({ balance: b, accrual, leaveYear, available, venueId, managerId, onClose, onSaved }) {
  const toast = useToast()
  const [kind, setKind]       = useState('carry_over')
  const [hours, setHours]     = useState('')
  const [payDate, setPayDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)

  const used = accrual ? holidayHoursUsed(b.leaveDays ?? [], accrual.avgDailyHours) : null
  const left = accrual
    ? zeroHoursLeft({ accrued: accrual.accrued, used, carriedOver: b.carriedOver, paidOut: b.paidOut })
    : null
  const n = parseFloat(hours)
  const valid = Number.isFinite(n) && n > 0 && n <= 1000
  const leftAfter = left != null && valid ? Math.round((kind === 'payout' ? left - n : left + n) * 10) / 10 : null

  const save = async () => {
    if (!valid) { toast('Enter the number of hours', 'error'); return }
    if (kind === 'payout' && !payDate) { toast('Pick the date it is paid on', 'error'); return }
    setSaving(true)
    const { error } = await addBalanceAdjustment({
      venue_id:   venueId,
      staff_id:   b.id,
      leave_year: leaveYear.startYear,
      kind,
      hours:      n,
      pay_date:   kind === 'payout' ? payDate : null,
      note:       note.trim() || null,
      created_by: managerId ?? null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(kind === 'payout' ? `${n} h paid out for ${b.name}` : `${n} h carried over for ${b.name}`)
    onSaved()
    onClose()
  }

  const remove = async (a) => {
    setSaving(true)
    const { error } = await removeBalanceAdjustment(a.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(a.kind === 'payout' ? 'Pay-out removed' : 'Carry-over removed')
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Holiday balance — ${b.name}`}>
      <div className="flex flex-col gap-3.5">
        {!available && (
          <p className="rounded-xl bg-warnBg dark:bg-warn/20 px-3.5 py-2.5 text-body-sm text-warn dark:text-warnDark">
            Carry-over and pay-outs need a database update (migration 148) before they can be saved.
          </p>
        )}

        <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 text-body-sm text-ink2 dark:text-white/70">
          {accrual ? (
            <>
              <p><span className="font-semibold text-ink dark:text-white">{Math.max(0, left)} h left</span> for {leaveYear.label}</p>
              <p className="mt-1 text-ink3 dark:text-white/45">
                {accrual.accrued} h earned
                {b.carriedOver > 0 && ` + ${b.carriedOver} h carried over`}
                {` − ${used} h holiday`}
                {b.paidOut > 0 && ` − ${b.paidOut} h paid out`}
              </p>
            </>
          ) : (
            <p className="text-ink3 dark:text-white/45">Working out their balance…</p>
          )}
        </div>

        <div className="flex gap-2" role="group" aria-label="Type">
          {KINDS.map(k => (
            <Button
              key={k.value}
              size="sm"
              variant={kind === k.value ? 'primary' : 'secondary'}
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
            >
              {k.label}
            </Button>
          ))}
        </div>

        <p className="text-body-sm text-ink3 dark:text-white/45 -mt-1.5">
          {kind === 'carry_over'
            ? `Unused hours from last holiday year, added to ${leaveYear.label}.`
            : 'Unused hours paid as money. They come off the balance and are paid on the timesheet for the pay date.'}
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <label>
            <span className={LABEL}>Hours</span>
            <input
              type="number" inputMode="decimal" min="0" step="0.25"
              value={hours} onChange={e => setHours(e.target.value)}
              placeholder="e.g. 8" className={FIELD}
            />
          </label>
          {kind === 'payout' && (
            <label>
              <span className={LABEL}>Paid on</span>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={FIELD} />
            </label>
          )}
        </div>
        {kind === 'payout' && left > 0 && (
          <Button variant="link" size="sm" className="self-start -mt-1.5" onClick={() => setHours(String(left))}>
            Pay out all {left} h
          </Button>
        )}

        <label>
          <span className={LABEL}>Note (optional)</span>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Leaving — final pay" className={FIELD} />
        </label>

        {leftAfter != null && (
          <p className={`text-body-sm ${leftAfter < 0 ? 'font-semibold text-bad dark:text-badDark' : 'text-ink3 dark:text-white/45'}`}>
            {leftAfter < 0
              ? `This is ${Math.abs(leftAfter)} h more than they have left — you can still save it.`
              : `${leftAfter} h left after this.`}
          </p>
        )}

        {kind === 'payout' && (
          <p className="text-body-sm text-ink3 dark:text-white/45">
            In the UK, statutory holiday usually can't be swapped for money except when someone leaves. Check with your accountant if they're staying on.
          </p>
        )}

        <Button fullWidth loading={saving} disabled={saving || !valid || !available} onClick={save}>
          {saving ? 'Saving…' : kind === 'payout' ? 'Pay out hours' : 'Carry over hours'}
        </Button>

        {b.adjustments?.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line dark:border-white/10 pt-3">
            <p className={LABEL}>This holiday year</p>
            {b.adjustments.map(a => (
              <div key={a.id} className="flex items-center gap-2.5">
                <span className="flex-1 min-w-0 text-body text-ink dark:text-white">
                  {a.kind === 'payout' ? `Paid out ${format(parseISO(a.pay_date), 'd MMM')}` : 'Carried over'}
                  {a.note && <span className="block text-body-sm text-ink3 dark:text-white/45 truncate">{a.note}</span>}
                </span>
                <span className="font-mono text-body text-ink dark:text-white">{a.kind === 'payout' ? '−' : '+'}{Number(a.hours)} h</span>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => remove(a)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
