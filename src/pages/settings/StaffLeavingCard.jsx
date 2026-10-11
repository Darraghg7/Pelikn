import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import { CARD } from '../../components/temperature/TempPageParts'
import { useVenue } from '../../contexts/VenueContext'
import { useStaffLeaving, useLeaverHoliday } from '../../hooks/useStaffLeaving'
import { markStaffLeaving, finishStaffLeaving, updateLeavingChecklist, cancelStaffLeaving } from '../../lib/api/staffLeaving'
import { LEAVING_REASONS, LEAVING_CHECKLIST } from '../../lib/leaving'
import { londonToday } from '../../lib/time'

const INPUT = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40'

const longDate = (d) => format(parseISO(d), 'EEEE d MMMM yyyy')
const shortDate = (d) => format(parseISO(d), 'EEE d MMM')
const reasonLabel = (v) => LEAVING_REASONS.find(r => r.value === v)?.label
const money = (n) => `£${Math.abs(n).toFixed(2)}`
const amount = (n, unit) => `${Math.abs(n)} ${unit === 'days' ? (Math.abs(n) === 1 ? 'day' : 'days') : (Math.abs(n) === 1 ? 'hour' : 'hours')}`

/**
 * "Staff leaving" on a person's profile: set their last day, see the holiday
 * they're owed, tick off the checklist, and switch their account off.
 *
 * @param {{ staff: object, onChanged?: () => void }} props
 *   staff — the useStaffManagement row. onChanged — reload the staff list
 *   (their active state may have changed).
 */
export default function StaffLeavingCard({ staff, onChanged }) {
  const { byId, missing, loading, reload } = useStaffLeaving()
  const leaving = byId[staff.id] ?? null
  // A finished row for someone who has since been reactivated is history, not a plan.
  const current = leaving && (!leaving.finished_at || !staff.is_active) ? leaving : null
  const [editing, setEditing] = useState(false)

  if (loading || missing) return null
  if (!current && !staff.is_active) return null

  return (
    <>
      <p className="px-1 -mb-1 text-caption font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">Leaving</p>
      {editing || !current
        ? <MarkLeaving staff={staff} leaving={current} editing={editing} setEditing={setEditing} reload={reload} />
        : <LeavingSummary staff={staff} leaving={current} onEdit={() => setEditing(true)} reload={reload} onChanged={onChanged} />}
    </>
  )
}

function MarkLeaving({ staff, leaving, editing, setEditing, reload }) {
  if (editing) {
    return <LeavingForm staff={staff} leaving={leaving} onDone={() => { setEditing(false); reload() }} onCancel={() => setEditing(false)} />
  }
  return (
    <div className={`${CARD} flex items-center justify-between gap-2.5 px-3.5 py-2.5`}>
      <p className="min-w-0 text-body-sm text-ink3 dark:text-white/45">Set their last day to see the holiday they’re owed. Pelikn switches their account off after it.</p>
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)} className="shrink-0">Mark as leaving</Button>
    </div>
  )
}

function LeavingForm({ staff, leaving, onDone, onCancel }) {
  const toast = useToast()
  const [lastDay, setLastDay] = useState(leaving?.last_day ?? londonToday())
  const [reason, setReason]   = useState(leaving?.reason ?? '')
  const [note, setNote]       = useState(leaving?.note ?? '')
  const [saving, setSaving]   = useState(false)

  const save = async () => {
    if (!lastDay) { toast('Choose their last working day', 'error'); return }
    setSaving(true)
    const { removedShifts, error } = await markStaffLeaving({ staffId: staff.id, lastDay, reason, note })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(removedShifts
      ? `Last day saved. ${removedShifts} rota ${removedShifts === 1 ? 'shift' : 'shifts'} after it removed.`
      : 'Last day saved')
    onDone()
  }

  return (
    <div className={`${CARD} px-3.5 py-3 flex flex-col gap-3`}>
      <p className="text-body font-semibold text-ink dark:text-white">{leaving ? 'Change leaving details' : `${staff.name} is leaving`}</p>
      <label className="block">
        <span className="block text-body-sm font-semibold text-ink3 dark:text-white/50 mb-2">Last working day</span>
        <input type="date" value={lastDay} onChange={e => setLastDay(e.target.value)} className={INPUT} />
      </label>
      <label className="block">
        <span className="block text-body-sm font-semibold text-ink3 dark:text-white/50 mb-2">Reason (optional)</span>
        <select value={reason} onChange={e => setReason(e.target.value)} className={INPUT}>
          <option value="">Not recorded</option>
          {LEAVING_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="block text-body-sm font-semibold text-ink3 dark:text-white/50 mb-2">Note (optional)</span>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Only managers can see this"
          className={`${INPUT} h-auto py-2.5 resize-none placeholder:text-ink4 dark:placeholder:text-white/30`}
        />
      </label>
      <p className="text-body-sm text-ink3 dark:text-white/45">Any rota shifts after this day are removed. They can keep signing in and clocking in until then.</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={save} className="flex-1">Save last day</Button>
      </div>
    </div>
  )
}

function LeavingSummary({ staff, leaving, onEdit, reload, onChanged }) {
  const toast = useToast()
  const { venueSlug } = useVenue()
  const { position, pay, hourlyRate, loading, failed } = useLeaverHoliday(staff, leaving.last_day)
  const [checklist, setChecklist] = useState(leaving.checklist ?? {})
  const [confirm, setConfirm] = useState(null)   // 'finish' | 'cancel'
  const [busy, setBusy] = useState(false)

  const today = londonToday()
  const finished = !!leaving.finished_at
  const canFinish = !finished && leaving.last_day <= today

  const tick = async (key) => {
    const next = { ...checklist, [key]: !checklist[key] }
    setChecklist(next)
    const { error } = await updateLeavingChecklist(staff.id, next)
    if (error) { setChecklist(checklist); toast(error.message, 'error'); return }
    reload()
  }

  const run = async () => {
    setBusy(true)
    const { error } = confirm === 'finish' ? await finishStaffLeaving(staff.id) : await cancelStaffLeaving(staff.id)
    setBusy(false)
    const what = confirm
    setConfirm(null)
    if (error) { toast(error.message, 'error'); return }
    toast(what === 'finish' ? `${staff.name}’s account is switched off. Their records are kept.` : `${staff.name} is no longer leaving`)
    reload()
    onChanged?.()
  }

  return (
    <div className={`${CARD} overflow-hidden divide-y divide-line dark:divide-white/10`}>
      {/* When */}
      <div className="px-3.5 py-3">
        <p className="text-title-sm font-bold text-ink dark:text-white">
          {finished ? `Last day was ${shortDate(leaving.last_day)}` : `Last day ${longDate(leaving.last_day)}`}
        </p>
        {(reasonLabel(leaving.reason) || leaving.note) && (
          <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">
            {[reasonLabel(leaving.reason), leaving.note].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Holiday */}
      <div className="px-3.5 py-3">
        <p className="text-body-sm font-semibold text-ink3 dark:text-white/50">Final holiday</p>
        <HolidayResult position={position} pay={pay} hourlyRate={hourlyRate} loading={loading} failed={failed} venueSlug={venueSlug} stillWorking={leaving.last_day >= today} />
      </div>

      {/* Checklist */}
      <div className="px-3.5 py-3 flex flex-col gap-2.5">
        <p className="text-body-sm font-semibold text-ink3 dark:text-white/50">Before they go</p>
        {LEAVING_CHECKLIST.map(item => (
          <label key={item.key} className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!checklist[item.key]}
              onChange={() => tick(item.key)}
              className="w-5 h-5 rounded accent-brand shrink-0"
            />
            <span className={`text-body ${checklist[item.key] ? 'text-ink3 dark:text-white/45 line-through' : 'text-ink dark:text-white'}`}>{item.label}</span>
          </label>
        ))}
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 shrink-0 rounded-full bg-goodBg dark:bg-good/20 text-good dark:text-goodDark inline-flex items-center justify-center" aria-hidden>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          <span className="text-body text-ink3 dark:text-white/45">Rota shifts after their last day removed by Pelikn</span>
        </div>
      </div>

      {/* Account */}
      <div className="px-3.5 py-3 flex flex-col gap-2">
        {finished ? (
          <p className="text-body-sm text-ink3 dark:text-white/45">Their account is switched off and their records are kept. Reactivate them below if they come back.</p>
        ) : canFinish ? (
          <>
            <p className="text-body-sm text-ink3 dark:text-white/45">Pelikn switches their account off tonight. You can do it now instead.</p>
            <Button variant="danger" size="sm" fullWidth onClick={() => setConfirm('finish')}>Switch off their account now</Button>
          </>
        ) : (
          <p className="text-body-sm text-ink3 dark:text-white/45">Pelikn switches their account off the night after {shortDate(leaving.last_day)}. Their records are kept.</p>
        )}
        {!finished && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">Change details</Button>
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirm('cancel')}>Not leaving</Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'finish'}
        title="Switch off their account?"
        message={`${staff.name} will be signed out on every device and can't sign in or clock in. Shifts and time off after their last day are removed. Their timesheets and records are kept.`}
        confirmLabel="Switch off"
        danger
        loading={busy}
        onConfirm={run}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        title={`${staff.name} isn’t leaving?`}
        message="Their leaving date and checklist are removed. Rota shifts already removed aren’t put back."
        confirmLabel="Not leaving"
        loading={busy}
        onConfirm={run}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

function HolidayResult({ position, pay, hourlyRate, loading, failed, venueSlug, stillWorking }) {
  if (loading) return <p className="text-body text-ink3 dark:text-white/45 mt-1">Working it out…</p>
  if (failed || !position) return <p className="text-body text-bad dark:text-badDark mt-1">Couldn’t load their holiday. Try again in a moment.</p>
  if (position.status === 'self_employed') {
    return <p className="text-body text-ink2 dark:text-white/75 mt-1">None — they’re set as not entitled to holiday pay.</p>
  }
  if (position.status === 'needs_region') {
    return (
      <p className="text-body text-ink2 dark:text-white/75 mt-1">
        Choose where your venue is first.{' '}
        <Button variant="link" to={`/v/${venueSlug}/settings/attendance`}>Settings → Attendance</Button>
      </p>
    )
  }

  const { owed, earned, used, unit, carriedOver } = position
  const carried = carriedOver ? ` + ${amount(carriedOver, unit)} carried over` : ''
  const yearLabel = position.holidayYear?.startMonth > 1 ? ` (${position.holidayYear.label})` : ''
  const owesBack = owed < 0
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <p className={`text-title-sm font-bold ${owesBack ? 'text-bad dark:text-badDark' : 'text-ink dark:text-white'}`}>
        {owed === 0
          ? 'Nothing owed either way'
          : owesBack
            ? `Took ${amount(owed, unit)} too many`
            : `${amount(owed, unit)} owed`}
        {pay != null && owed !== 0 && <span className="font-semibold text-ink3 dark:text-white/50"> · {money(pay)}</span>}
      </p>
      <p className="text-body-sm text-ink3 dark:text-white/45">
        {position.region === 'gb'
          ? `Built up ${amount(earned, unit)} by their last day (12.07% of hours worked)${carried}, ${amount(used, unit)} used${yearLabel}.`
          : `Earned ${amount(earned, unit)} by their last day${carried}, ${amount(used, unit)} used this holiday year${yearLabel}.`}
        {stillWorking && ' Updates as they work up to their last day.'}
      </p>
      {owesBack && (
        <p className="text-body-sm text-ink2 dark:text-white/70">You can only take this back from their final pay if their contract allows it.</p>
      )}
      {position.noAverage && (
        <p className="text-body-sm text-warn dark:text-warnDark">No clocked hours to work out their average week, so this shows nothing earned.</p>
      )}
      {position.usedIsEstimate && (
        <p className="text-body-sm text-ink3 dark:text-white/45">Some holiday used is an estimate — no hours were recorded for it.</p>
      )}
      {pay != null && owed !== 0 && (
        <p className="text-body-sm text-ink3 dark:text-white/45">
          At their current rate of £{Number(hourlyRate).toFixed(2)} an hour. If their pay varies, holiday pay should use their average pay instead — check with payroll.
        </p>
      )}
      {pay == null && owed !== 0 && (
        <p className="text-body-sm text-ink3 dark:text-white/45">
          {unit === 'days' ? 'Add their pay rate and contracted hours to see this in pounds.' : 'Add their pay rate to see this in pounds.'}
        </p>
      )}
    </div>
  )
}
