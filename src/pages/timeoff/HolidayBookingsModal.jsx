import React, { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { sendPush } from '../../lib/sendPush'
import { estimateLeaveHours } from '../../lib/holiday'
import { countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { markNotHoliday, restoreAsHoliday } from '../../lib/api/timeOff'
import { fmtDays } from './timeOffConstants'

const round1 = (n) => Math.round(n * 10) / 10

function when(r) {
  const start = parseISO(r.start_date)
  if (r.start_date === r.end_date) return format(start, 'EEE d MMM')
  return `${format(start, 'EEE d MMM')} – ${format(parseISO(r.end_date), 'EEE d MMM')}`
}

/**
 * The holiday someone has booked this holiday year, from their name on the
 * team holiday list — so a manager can see where the balance went and say
 * "that wasn't paid holiday, they just weren't available".
 *
 * Zero-hours staff often book "annual leave" for days they simply can't work.
 * Pelikn then counts it as holiday taken and their balance goes negative.
 * "Not holiday" changes the booking to Not available: it still keeps them off
 * the rota, but no longer uses holiday.
 *
 * @param {object} props
 * @param {{ id: string, name: string, isZeroHours: boolean }} props.staff  team balance row
 * @param {object|undefined} props.holiday   zeroHoursHoliday result (zero-hours only)
 * @param {object[]} props.requests  every request the page loaded (filtered here)
 * @param {import('../../lib/holidayYear').HolidayYear} props.holidayYear
 * @param {string} props.venueId
 * @param {() => void} props.onClose
 * @param {() => void} props.onSaved
 */
export default function HolidayBookingsModal({ staff, holiday, requests, holidayYear, venueId, onClose, onSaved }) {
  const toast = useToast()
  // Bookings changed while this is open, with the hours they had, so Undo can put them back.
  const [changed, setChanged] = useState(() => new Map())
  const [busy, setBusy] = useState(null)        // booking id, or 'all'
  const [confirmAll, setConfirmAll] = useState(false)

  const bookings = useMemo(
    () => requests
      .filter(r => r.staff_id === staff.id && r.status === 'approved'
        && (r.leave_type === 'annual' || changed.has(r.id))
        && r.end_date >= holidayYear.start && r.start_date <= holidayYear.end)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [requests, staff.id, changed, holidayYear],
  )

  const cost = (r) => {
    const from = r.start_date < holidayYear.start ? holidayYear.start : r.start_date
    const to   = r.end_date   > holidayYear.end   ? holidayYear.end   : r.end_date
    if (!staff.isZeroHours) return { text: fmtDays(countWorkingDaysInRequest(from, to, r.staff?.working_days)), confirmed: true }
    if (r.paid_hours != null) return { text: `${round1(Number(r.paid_hours))} h paid`, confirmed: true }
    const h = estimateLeaveHours(from, to, holiday?.avgWeekHours, r.staff?.working_days)
    return { text: h ? `about ${round1(h)} h` : 'no hours', confirmed: false }
  }

  const stillHoliday = bookings.filter(r => !changed.has(r.id))
  const unconfirmed  = staff.isZeroHours ? stillHoliday.filter(r => r.paid_hours == null) : []

  const tellThem = (count) => {
    sendPush({
      venueId,
      notificationType: 'time_off_decision',
      title: 'Time off changed',
      body: count === 1
        ? 'A manager changed one of your annual leave bookings to Not available. It doesn\'t use your holiday.'
        : `A manager changed ${count} of your annual leave bookings to Not available. They don't use your holiday.`,
      url: '/time-off',
      staffIds: [staff.id],
    })
  }

  const change = async (rows) => {
    setBusy(rows.length === 1 ? rows[0].id : 'all')
    const { error } = await markNotHoliday(rows.map(r => r.id))
    setBusy(null)
    setConfirmAll(false)
    if (error) { toast(error.message, 'error'); onSaved(); return }
    setChanged(m => {
      const next = new Map(m)
      for (const r of rows) next.set(r.id, r.paid_hours ?? null)
      return next
    })
    toast(rows.length === 1 ? 'Changed to Not available' : `${rows.length} bookings changed to Not available`)
    tellThem(rows.length)
    onSaved()
  }

  const undo = async (r) => {
    setBusy(r.id)
    const { error } = await restoreAsHoliday(r.id, changed.get(r.id) ?? null)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    setChanged(m => { const next = new Map(m); next.delete(r.id); return next })
    toast('Back to annual leave')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={`${staff.name} — holiday ${holidayYear.label}`}>
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-ink3 dark:text-white/45">
          Annual leave booked this holiday year. If a day wasn’t paid holiday — they just weren’t available to work — tap
          <span className="font-semibold text-ink2 dark:text-white/75"> Not holiday</span>. It still keeps them off the rota but stops using their holiday.
        </p>

        {bookings.length === 0 ? (
          <p className="text-body text-ink3 dark:text-white/45 py-4 text-center">No annual leave booked this holiday year.</p>
        ) : (
          <div className="rounded-xl border border-line dark:border-white/10 divide-y divide-line dark:divide-white/10 overflow-hidden">
            {bookings.map(r => {
              const isChanged = changed.has(r.id)
              const c = cost(r)
              return (
                <div key={r.id} className="flex items-center gap-2.5 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-body font-semibold ${isChanged ? 'text-ink3 dark:text-white/45' : 'text-ink dark:text-white'}`}>{when(r)}</p>
                    <p className="text-body-sm text-ink3 dark:text-white/45">
                      {isChanged ? 'Not available · doesn’t use holiday' : c.confirmed ? c.text : `${c.text} · not confirmed`}
                    </p>
                  </div>
                  {isChanged ? (
                    <Button variant="ghost" size="sm" loading={busy === r.id} onClick={() => undo(r)} className="shrink-0">Undo</Button>
                  ) : (
                    <Button variant="secondary" size="sm" loading={busy === r.id} disabled={!!busy} onClick={() => change([r])} className="shrink-0">Not holiday</Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {unconfirmed.length > 1 && (
          <Button variant="secondary" fullWidth disabled={!!busy} onClick={() => setConfirmAll(true)}>
            Change all {unconfirmed.length} unconfirmed to Not available
          </Button>
        )}

        <Button fullWidth onClick={onClose}>Done</Button>
      </div>

      <ConfirmDialog
        open={confirmAll}
        title={`Change ${unconfirmed.length} bookings?`}
        message={`Every annual leave booking for ${staff.name} without confirmed paid hours becomes Not available. They stay off the rota on those days, but it no longer uses their holiday. Bookings with paid hours recorded are left alone.`}
        confirmLabel="Change them"
        loading={busy === 'all'}
        onConfirm={() => change(unconfirmed)}
        onClose={() => setConfirmAll(false)}
      />
    </Modal>
  )
}
