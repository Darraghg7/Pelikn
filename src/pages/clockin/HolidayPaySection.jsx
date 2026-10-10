import React, { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { CARD } from '../../components/temperature/TempPageParts'
import { allocateHolidayPay, removeHolidayAllocations } from '../../lib/api/holidayPay'
import { reportError } from '../../lib/reportError'

const round1 = (n) => Math.round(n * 10) / 10
const gbp = (n) => `£${Number(n).toFixed(2)}`
const dayLabel = (date) => format(parseISO(date), 'EEE d MMM')

/**
 * Holiday booked in the timesheet period, and the manager's "Allocate holiday
 * pay" step. Nothing is paid for a day off until hours are allocated to it;
 * the allocated hours are what's paid and what comes off the person's balance.
 *
 * rows: [{ staffId, name, hourlyRate, days, payoutHours }] — days from
 * leaveDaysInRange, only those that are working days or already have hours
 * allocated; payoutHours is unused holiday paid out in the period.
 */
export default function HolidayPaySection({ rows, available, locked, onAllocate }) {
  if (!rows.length) return null
  return (
    <>
      <p className="px-1 -mb-1 text-caption font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">Holiday pay</p>
      <div className={`${CARD} overflow-hidden`}>
        {!available && (
          <p className="px-3.5 py-2.5 bg-warnBg dark:bg-warn/20 text-body-sm text-warn dark:text-warnDark">
            Holiday pay is still being estimated automatically — allocating it needs a database update (migration 148).
          </p>
        )}
        <div className="divide-y divide-line dark:divide-white/10">
          {rows.map(r => {
            const allocated = r.days.filter(d => d.allocatedHours != null)
            const waiting   = r.days.length - allocated.length
            const hours     = round1(allocated.reduce((sum, d) => sum + d.allocatedHours, 0))
            return (
              <div key={r.staffId} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-body font-semibold text-ink dark:text-white truncate">{r.name}</p>
                  {r.days.length > 0 && (
                    <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">
                      {r.days.length} day{r.days.length === 1 ? '' : 's'} off
                      {available && hours > 0 && ` · ${hours} h paid${r.hourlyRate > 0 ? ` (${gbp(hours * r.hourlyRate)})` : ''}`}
                    </p>
                  )}
                  {r.payoutHours > 0 && (
                    <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">
                      {round1(r.payoutHours)} h holiday paid out{r.hourlyRate > 0 ? ` (${gbp(r.payoutHours * r.hourlyRate)})` : ''}
                    </p>
                  )}
                  {available && waiting > 0 && (
                    <p className="text-body-sm font-semibold text-warn dark:text-warnDark mt-0.5">
                      {waiting} day{waiting === 1 ? '' : 's'} not paid yet
                    </p>
                  )}
                </div>
                {available && r.days.length > 0 && (
                  <Button size="sm" variant={waiting > 0 ? 'primary' : 'secondary'} onClick={() => onAllocate(r.staffId)}>
                    {waiting > 0 ? 'Allocate' : 'View'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        {locked && available && (
          <p className="px-3.5 py-2 border-t border-line dark:border-white/10 text-body-sm text-ink3 dark:text-white/45">
            This period is locked for payroll — unlock it to change holiday pay.
          </p>
        )}
      </div>
    </>
  )
}

/**
 * row: one entry from HolidayPaySection's rows.
 * suggestedHours: hours to pre-fill for each unpaid day.
 * loadBalance: () => Promise<{ accrued, used } | null> — holiday hours earned
 *   and used this holiday year, or null when it doesn't apply (e.g. salaried).
 */
export function AllocateHolidayModal({ row, venueId, managerId, locked, suggestedHours, loadBalance, onClose, onSaved }) {
  const toast = useToast()
  const unpaid = useMemo(() => row.days.filter(d => d.allocatedHours == null), [row.days])
  const paid   = useMemo(() => row.days.filter(d => d.allocatedHours != null), [row.days])
  const [hours, setHours]     = useState(() => Object.fromEntries(unpaid.map(d => [d.date + d.requestId, String(suggestedHours)])))
  const [saving, setSaving]   = useState(false)
  const [balance, setBalance] = useState(undefined) // undefined = loading, null = not applicable

  useEffect(() => {
    let cancelled = false
    loadBalance()
      .then(b => { if (!cancelled) setBalance(b) })
      .catch((e) => { reportError(e, 'AllocateHolidayModal:balance'); if (!cancelled) setBalance(null) })
    return () => { cancelled = true }
  }, [loadBalance])

  const valueFor = (d) => {
    const n = parseFloat(hours[d.date + d.requestId])
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const newHours = round1(unpaid.reduce((sum, d) => sum + valueFor(d), 0))
  const invalid  = unpaid.some(d => valueFor(d) > 24)

  // Unpaid days are already in `used` as an estimate (their average shift) —
  // swap that estimate for the hours being allocated now.
  const leftNow   = balance
    ? round1(balance.accrued + (balance.carriedOver ?? 0) - (balance.paidOut ?? 0) - balance.used)
    : null
  const estimated = balance ? round1(unpaid.length * balance.avgDailyHours) : 0
  const leftAfter = balance ? round1(leftNow + estimated - newHours) : null

  const save = async () => {
    const rows = unpaid.filter(d => valueFor(d) > 0).map(d => ({
      venue_id:            venueId,
      staff_id:            row.staffId,
      time_off_request_id: d.requestId,
      leave_date:          d.date,
      hours:               valueFor(d),
      allocated_by:        managerId ?? null,
    }))
    if (!rows.length) { toast('Enter the hours to pay for at least one day', 'error'); return }
    setSaving(true)
    const { error } = await allocateHolidayPay(rows)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Holiday pay allocated for ${row.name}`)
    onSaved()
    onClose()
  }

  const remove = async (d) => {
    setSaving(true)
    const { error } = await removeHolidayAllocations([d.allocationId])
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Holiday pay for ${dayLabel(d.date)} removed`)
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Holiday pay — ${row.name}`}>
      <div className="flex flex-col gap-3.5">
        {balance !== null && (
          <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 text-body-sm">
            {balance === undefined ? (
              <p className="text-ink3 dark:text-white/45">Checking their holiday balance…</p>
            ) : (
              <>
                <p className="text-ink2 dark:text-white/70">
                  <span className="font-semibold text-ink dark:text-white">{leftNow} h</span> holiday left ({balance.accrued} h earned this holiday year
                  {balance.carriedOver > 0 && `, ${balance.carriedOver} h carried over`}
                  {balance.paidOut > 0 && `, ${balance.paidOut} h paid out`})
                </p>
                {unpaid.length > 0 && (
                  <p className={`mt-1 ${leftAfter < 0 ? 'font-semibold text-bad dark:text-badDark' : 'text-ink3 dark:text-white/45'}`}>
                    {leftAfter < 0
                      ? `This is ${Math.abs(leftAfter)} h more than they have left — you can still allocate it.`
                      : `${leftAfter} h left after this.`}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {unpaid.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm font-semibold text-ink3 dark:text-white/50">Hours to pay</p>
            {unpaid.map(d => (
              <label key={d.date + d.requestId} className="flex items-center gap-2.5">
                <span className="flex-1 text-body text-ink dark:text-white">{dayLabel(d.date)}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="24"
                  step="0.25"
                  disabled={locked}
                  value={hours[d.date + d.requestId] ?? ''}
                  onChange={e => setHours(h => ({ ...h, [d.date + d.requestId]: e.target.value }))}
                  aria-label={`Hours for ${dayLabel(d.date)}`}
                  className="w-24 h-10 px-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body text-right text-ink dark:text-white"
                />
                <span className="text-body-sm text-ink3 dark:text-white/45">h</span>
              </label>
            ))}
            <p className="text-body-sm text-ink3 dark:text-white/45">
              Suggested: {suggestedHours} h a day (their average shift). Leave a day at 0 to skip it.
            </p>
          </div>
        )}

        {paid.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-body-sm font-semibold text-ink3 dark:text-white/50">Already paid</p>
            {paid.map(d => (
              <div key={d.allocationId} className="flex items-center gap-2.5">
                <span className="flex-1 text-body text-ink dark:text-white">{dayLabel(d.date)}</span>
                <span className="font-mono text-body text-ink dark:text-white">{d.allocatedHours} h</span>
                {!locked && (
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => remove(d)}>Remove</Button>
                )}
              </div>
            ))}
          </div>
        )}

        {invalid && <p className="text-body-sm text-bad dark:text-badDark">A day can't be more than 24 hours.</p>}

        {unpaid.length > 0 && !locked && (
          <Button fullWidth loading={saving} disabled={saving || invalid || newHours <= 0} onClick={save}>
            {saving ? 'Saving…' : `Allocate ${newHours} h${row.hourlyRate > 0 ? ` (${gbp(newHours * row.hourlyRate)})` : ''}`}
          </Button>
        )}
      </div>
    </Modal>
  )
}
