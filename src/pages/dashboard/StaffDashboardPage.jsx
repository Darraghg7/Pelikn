import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format, addDays, startOfWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { useClockStatus } from '../../hooks/useClockEvents'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useAppSettings } from '../../hooks/useSettings'
import { useTodayDuties } from '../../hooks/useDuties'
import ClockPanel from '../../components/shifts/ClockPanel'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AcknowledgeModal from '../../components/training/AcknowledgeModal'

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0') }

function fmtElapsed(ms) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms / 1000)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

function shiftDurationH(start, end) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return (mins / 60).toFixed(1)
}

function timeToDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`)
}

// ── State pill ─────────────────────────────────────────────────────────────────

function StatePill({ clockStatus, todayShift }) {
  let label = 'NO SHIFT'
  let style = { background: 'rgba(255,255,255,0.14)', color: '#fff' }

  if (todayShift) {
    const now = new Date()
    const shiftStart = timeToDate(todayShift.shift_date, todayShift.start_time)
    const shiftEnd   = timeToDate(todayShift.shift_date, todayShift.end_time)

    if (clockStatus === 'clocked_in' && now > shiftEnd) {
      label = 'OVERRUN'
      style = { background: 'rgba(252,188,80,0.22)', color: '#f7c473' }
    } else if (clockStatus === 'clocked_in') {
      label = 'ON SHIFT'
      style = { background: 'rgba(83,212,131,0.18)', color: '#7eecaa' }
    } else if (clockStatus === 'on_break') {
      label = 'ON BREAK'
      style = { background: 'rgba(252,188,80,0.22)', color: '#f7c473' }
    } else if (now < shiftStart) {
      label = 'STARTING SOON'
      style = { background: 'rgba(255,255,255,0.14)', color: '#fff' }
    } else {
      label = 'NOT CLOCKED IN'
      style = { background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }
    }
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      fontFamily: 'var(--font-mono, ui-monospace, monospace)',
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
      ...style,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
      {label}
    </span>
  )
}

// ── Live elapsed timer ─────────────────────────────────────────────────────────

function LiveTimer({ clockInAt, breakStartAt, totalBreakMs, status }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!clockInAt) return null

  const currentBreakMs = status === 'on_break' && breakStartAt
    ? now - breakStartAt.getTime()
    : 0
  const workingMs = now - clockInAt.getTime() - totalBreakMs - currentBreakMs

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 10.5, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
          {status === 'on_break' ? 'Break elapsed' : 'Clocked in · elapsed'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 19, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          {status === 'on_break' && breakStartAt ? fmtElapsed(currentBreakMs) : fmtElapsed(workingMs)}
        </span>
      </div>
      {totalBreakMs > 0 && status !== 'on_break' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Breaks used
          </span>
          <span style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 12, color: 'rgba(255,255,255,0.65)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtElapsed(totalBreakMs)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Shift hero card ────────────────────────────────────────────────────────────

function ShiftHeroCard({ todayShift, hourlyRate, staffId, hasShift }) {
  const { status, clockInAt, breakStartAt, totalBreakMs } = useClockStatus(staffId)

  const durationH = todayShift ? shiftDurationH(todayShift.start_time, todayShift.end_time) : null
  const estPay    = durationH && hourlyRate > 0 ? (parseFloat(durationH) * hourlyRate).toFixed(2) : null

  return (
    <div style={{ background: '#13362a', color: '#fff', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 0' }}>
        {/* Label + state pill */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 10.5, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            Your shift
          </span>
          <StatePill clockStatus={status} todayShift={todayShift} />
        </div>

        {/* Shift times */}
        {todayShift ? (
          <div style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 8, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>
            {todayShift.start_time.slice(0, 5)} — {todayShift.end_time.slice(0, 5)}
          </div>
        ) : (
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 8, color: 'rgba(255,255,255,0.55)' }}>
            No shift today
          </div>
        )}

        {/* Meta row */}
        {todayShift && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            {todayShift.role_label && <span>{todayShift.role_label}</span>}
            {todayShift.role_label && durationH && <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>}
            {durationH && <span style={{ fontFamily: 'var(--font-mono, ui-monospace)' }}>{durationH}h</span>}
            {estPay && <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>}
            {estPay && <span style={{ fontFamily: 'var(--font-mono, ui-monospace)' }}>£{estPay}</span>}
          </div>
        )}

        {/* Timer */}
        {status !== 'clocked_out' && (
          <LiveTimer
            clockInAt={clockInAt}
            breakStartAt={breakStartAt}
            totalBreakMs={totalBreakMs}
            status={status}
          />
        )}
      </div>

      {/* Clock buttons — use ClockPanel compact */}
      <div style={{ padding: 12 }}>
        <ClockPanel staffId={staffId} hasShift={hasShift} compact />
      </div>
    </div>
  )
}

// ── Alert strip ────────────────────────────────────────────────────────────────

function AlertStrip({ fridgesUnchecked, cleaningDue, venueSlug }) {
  const hasIssues = fridgesUnchecked > 0 || cleaningDue > 0

  if (!hasIssues) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-success/8 border border-success/20 text-success text-sm font-medium">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        All caught up today
      </div>
    )
  }

  const items = [
    fridgesUnchecked > 0 && {
      text: `${fridgesUnchecked} fridge${fridgesUnchecked !== 1 ? 's' : ''} unchecked`,
      link: `/v/${venueSlug}/fridge/log`,
    },
    cleaningDue > 0 && {
      text: `${cleaningDue} cleaning task${cleaningDue !== 1 ? 's' : ''} due`,
      link: `/v/${venueSlug}/cleaning`,
    },
  ].filter(Boolean)

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/8 border border-warning/25 text-warning">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      <div className="flex flex-col gap-0.5 text-sm">
        {items.map(item => (
          <Link key={item.link} to={item.link} className="font-semibold hover:underline">{item.text}</Link>
        ))}
      </div>
    </div>
  )
}

// ── Quick log row ──────────────────────────────────────────────────────────────

function QuickLogRow({ venueSlug, isEnabled, hasPermission }) {
  const buttons = [
    isEnabled('fridge') && hasPermission('log_temps') && {
      label: 'Fridge temp',
      link: `/v/${venueSlug}/fridge/log`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z"/>
        </svg>
      ),
    },
    isEnabled('opening_closing') && {
      label: 'Checks',
      link: `/v/${venueSlug}/opening-closing`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/>
        </svg>
      ),
    },
    isEnabled('allergens') && hasPermission('manage_allergens') && {
      label: 'Allergens',
      link: `/v/${venueSlug}/allergens`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
      ),
    },
  ].filter(Boolean)

  if (!buttons.length) return null

  return (
    <div>
      <p className="text-[10.5px] font-mono tracking-widest uppercase text-charcoal/40 px-1 mb-2">Log quickly</p>
      <div className="grid grid-cols-3 gap-2">
        {buttons.map(b => (
          <Link
            key={b.label}
            to={b.link}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-charcoal/8 hover:border-charcoal/20 transition-colors text-center"
          >
            <span className="w-8 h-8 rounded-lg bg-brand/8 text-brand flex items-center justify-center">
              {b.icon}
            </span>
            <span className="text-[12px] text-charcoal/70 font-medium leading-tight">{b.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Duties checklist (restyled) ────────────────────────────────────────────────

function DutyItemRow({ item, assignmentId, toggleItem }) {
  const [busy, setBusy] = useState(false)
  const handleToggle = async () => {
    if (busy) return
    setBusy(true)
    const { error } = await toggleItem(assignmentId, item.id, item.completed)
    if (error) setBusy(false)
    else setTimeout(() => setBusy(false), 150)
  }
  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      className="min-h-11 flex items-center gap-3 w-full text-left py-2.5 px-4 group disabled:opacity-70 hover:bg-charcoal/3 transition-colors border-t border-charcoal/5 first:border-t-0"
    >
      <span className={[
        'w-[22px] h-[22px] rounded-md border-[1.5px] shrink-0 flex items-center justify-center transition-all',
        item.completed
          ? 'bg-success border-success'
          : 'border-charcoal/25 group-hover:border-charcoal/45',
      ].join(' ')}>
        {item.completed && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6 5,9 10,3"/>
          </svg>
        )}
      </span>
      <span className={`text-[13.5px] leading-snug flex-1 ${item.completed ? 'line-through text-charcoal/35' : 'text-charcoal font-medium'}`}>
        {item.title}
      </span>
      {!item.completed && (
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 shrink-0">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      )}
    </button>
  )
}

function DutyCard({ duty, toggleItem }) {
  const done  = duty.items.filter(i => i.completed).length
  const total = duty.items.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = done === total && total > 0

  return (
    <div className="bg-white rounded-[14px] border border-charcoal/8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-charcoal/6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[9.5px] text-charcoal/40 tracking-widest uppercase font-semibold shrink-0">Duty</span>
          <span className="text-charcoal/25 text-xs">·</span>
          <p className="text-[15px] font-semibold text-charcoal truncate">{duty.title}</p>
        </div>
        <span className={`text-[10.5px] font-mono font-semibold shrink-0 ml-2 ${allDone ? 'text-success' : 'text-charcoal/35'}`}>
          {done}/{total}
        </span>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-[3px] bg-charcoal/6">
          <div
            className={`h-full transition-all ${allDone ? 'bg-success' : 'bg-warning'}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      )}

      {/* Items */}
      <div>
        {duty.items.map(item => (
          <DutyItemRow key={item.id} item={item} assignmentId={duty.assignmentId} toggleItem={toggleItem} />
        ))}
      </div>
    </div>
  )
}

function PendingTrainingCard({ staffId, staffName, isManager }) {
  if (isManager) return null
  const [records, setRecords] = useState([])
  const [ackRecord, setAckRecord] = useState(null)

  const load = useCallback(async () => {
    if (!staffId) return
    const { data } = await supabase
      .from('training_sign_offs')
      .select('id, training_date, trainer_name, topics, notes, manager_name, manager_signature')
      .eq('staff_id', staffId)
      .eq('staff_acknowledged', false)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
  }, [staffId])

  useEffect(() => { load() }, [load])

  if (!records.length) return null

  return (
    <>
      <div className="bg-white rounded-2xl border border-accent/20 overflow-hidden">
        <div className="px-4 py-3 bg-accent/5 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <p className="text-sm font-semibold text-accent">
            {records.length === 1 ? 'Training record needs your signature' : `${records.length} training records need your signature`}
          </p>
        </div>
        <div className="divide-y divide-charcoal/6">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-charcoal font-medium truncate">{r.trainer_name}</p>
                <p className="text-xs text-charcoal/40 mt-0.5">
                  {new Date(r.training_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}{r.topics.length} topic{r.topics.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setAckRecord(r)}
                className="shrink-0 bg-accent text-cream text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
              >
                Sign now
              </button>
            </div>
          ))}
        </div>
      </div>

      {ackRecord && (
        <AcknowledgeModal
          record={ackRecord}
          staffName={staffName}
          onSaved={() => { setAckRecord(null); load() }}
          onClose={() => setAckRecord(null)}
        />
      )}
    </>
  )
}

function TodayDuties({ staffId }) {
  const { duties, loading, toggleItem } = useTodayDuties(staffId)
  if (loading || !duties.length) return null
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10.5px] font-mono tracking-widest uppercase text-charcoal/40 px-1">Your duties today</p>
      {duties.map(d => (
        <DutyCard key={d.assignmentId} duty={d} toggleItem={toggleItem} />
      ))}
    </div>
  )
}

// ── Notifications card (always visible) ───────────────────────────────────────

function NotificationsCard({ staffId, venueId }) {
  const { supported, permission, subscribed, subscribing, subscribe } =
    usePushNotifications(staffId, venueId)

  return (
    <div className="bg-white rounded-[14px] border border-charcoal/8 p-4 flex items-center gap-3">
      <span className="shrink-0 w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-charcoal">Notifications</p>
        {subscribed
          ? <p className="text-[11px] text-success mt-0.5 font-medium">Push notifications enabled</p>
          : <p className="text-[11px] text-charcoal/45 mt-0.5">Get notified about rota changes and shift updates.</p>
        }
      </div>
      {subscribed ? (
        <span className="shrink-0 w-6 h-6 rounded-full bg-success/15 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-success" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6 5,9 10,3"/>
          </svg>
        </span>
      ) : supported && permission !== 'denied' ? (
        <button onClick={subscribe} disabled={subscribing}
          className="shrink-0 bg-charcoal text-cream rounded-lg text-[12px] font-semibold px-3 py-1.5 hover:bg-charcoal/85 transition-colors disabled:opacity-40">
          {subscribing ? 'Enabling…' : 'Enable'}
        </button>
      ) : null}
    </div>
  )
}

// ── Opening/closing checks on My Shift ────────────────────────────────────────

function useChecksForShift(venueId) {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!venueId) return
    supabase
      .from('opening_closing_checks')
      .select('id, title, type, sort_order')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
      .then(({ data }) => { setChecks(data ?? []); setLoading(false) })
  }, [venueId])
  return { checks, loading }
}

function useShiftCompletions(venueId, dateStr, sessionType) {
  const [completions, setCompletions] = useState([])
  const load = useCallback(async () => {
    if (!venueId || !dateStr) return
    const { data } = await supabase
      .from('opening_closing_completions')
      .select('id, check_id, corrective_action, staff_name, completed_at')
      .eq('venue_id', venueId)
      .eq('session_date', dateStr)
      .eq('session_type', sessionType)
    setCompletions(data ?? [])
  }, [venueId, dateStr, sessionType])
  useEffect(() => { load() }, [load])
  return { completions, reload: load }
}

function TodayChecks({ venueId, venueSlug, staffName }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const sessionType = new Date().getHours() < 14 ? 'opening' : 'closing'
  const { checks, loading } = useChecksForShift(venueId)
  const { completions, reload } = useShiftCompletions(venueId, today, sessionType)
  const [saving, setSaving] = useState(null)
  const [open, setOpen] = useState(false)

  if (loading) return null
  if (!checks.length) return null

  const done = completions.length
  const total = checks.length
  const allDone = done === total && total > 0
  const pendingChecks = checks.filter(c => !completions.find(comp => comp.check_id === c.id))

  const markOk = async (checkId) => {
    if (saving) return
    setSaving(checkId)
    await supabase.from('opening_closing_completions').upsert({
      venue_id: venueId,
      check_id: checkId,
      session_date: today,
      session_type: sessionType,
      completed_at: new Date().toISOString(),
      staff_name: staffName ?? 'Staff',
      corrective_action: null,
    }, { onConflict: 'venue_id,check_id,session_date,session_type' })
    setSaving(null)
    reload()
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header — non-interactive when all done */}
      <button
        onClick={() => !allDone && setOpen(v => !v)}
        className={`flex items-center justify-between w-full px-0.5 py-1 ${allDone ? 'cursor-default' : 'group'}`}
      >
        <span className="text-[10.5px] font-mono tracking-widest uppercase text-charcoal/40 font-semibold">
          {sessionType === 'opening' ? 'Opening Checks' : 'Closing Checks'}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono ${allDone ? 'text-success font-semibold' : 'text-charcoal/35'}`}>
            {done}/{total}
          </span>
          {!allDone && (
            <svg
              className={`w-3.5 h-3.5 text-charcoal/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>
      </button>

      {/* Progress bar — always visible */}
      <div className="h-[3px] bg-charcoal/6 rounded-full overflow-hidden mx-0.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-success' : 'bg-brand/50'}`}
          style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
        />
      </div>

      {/* All done — compact confirmation row */}
      {allDone && (
        <div className="bg-success/8 rounded-[14px] px-4 py-3 flex items-center gap-2">
          <span className="text-success text-[13px] font-semibold">All checks completed</span>
          <a
            href={`/v/${venueSlug}/opening-closing`}
            className="ml-auto text-[11px] font-semibold text-success/70 hover:text-success transition-colors"
          >
            View →
          </a>
        </div>
      )}

      {/* Expandable pending check list */}
      {!allDone && open && (
        <div className="bg-white rounded-[14px] border border-charcoal/8 overflow-hidden">
          {pendingChecks.map((check, i) => (
            <div key={check.id} className={`px-4 py-3 flex items-center gap-3 ${i > 0 ? 'border-t border-charcoal/5' : ''}`}>
              <p className="text-[13.5px] flex-1 font-medium text-charcoal">{check.title}</p>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => markOk(check.id)}
                  disabled={!!saving}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all bg-charcoal/6 text-charcoal/45 hover:bg-success/10 hover:text-success disabled:opacity-40"
                >
                  {saving === check.id ? '…' : '✓ OK'}
                </button>
                <a
                  href={`/v/${venueSlug}/opening-closing`}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-charcoal/6 text-charcoal/45 hover:bg-warning/10 hover:text-warning transition-all"
                >
                  ⚠ Issue
                </a>
              </div>
            </div>
          ))}
          <a
            href={`/v/${venueSlug}/opening-closing`}
            className="flex items-center justify-between px-4 py-3 border-t border-charcoal/5 text-[12px] font-semibold text-brand hover:bg-brand/3 transition-colors"
          >
            View full checks
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}

// ── Today summary data ─────────────────────────────────────────────────────────

function useTodaySummary({ staffId, venueId, isEnabled, hasPermission, closedDays }) {
  const [data, setData] = useState({ fridgesUnchecked: 0, cleaningDue: 0, loaded: false, closedToday: false })

  useEffect(() => {
    if (!staffId || !venueId) return
    let cancelled = false
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayDow = (new Date().getDay() + 6) % 7

    if (closedDays.includes(todayDow)) {
      setData({ fridgesUnchecked: 0, cleaningDue: 0, loaded: true, closedToday: true })
      return
    }

    supabase.from('venue_closures')
      .select('id, reason').eq('venue_id', venueId)
      .lte('start_date', today).gte('end_date', today).limit(1)
      .then(({ data: closures }) => {
        if (cancelled) return
        if (closures?.length) {
          setData({ fridgesUnchecked: 0, cleaningDue: 0, loaded: true, closedToday: closures[0].reason || true })
          return
        }
        loadCounts()
      })

    async function loadCounts() {
      const promises = []

      if (isEnabled('cleaning') && hasPermission('manage_cleaning')) {
        promises.push(
          supabase.from('cleaning_tasks').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('is_active', true)
            .then(({ count }) => ({ type: 'total_cleaning', count: count ?? 0 }))
        )
        promises.push(
          supabase.from('cleaning_completions').select('id', { count: 'exact', head: true })
            .eq('venue_id', venueId).gte('completed_at', today + 'T00:00:00')
            .then(({ count }) => ({ type: 'done_cleaning', count: count ?? 0 }))
        )
      }

      if (isEnabled('fridge') && hasPermission('log_temps')) {
        promises.push(
          supabase.from('fridges').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('is_active', true)
            .then(({ count }) => ({ type: 'total_fridges', count: count ?? 0 }))
        )
        promises.push(
          supabase.from('fridge_temperature_logs').select('fridge_id').eq('venue_id', venueId).gte('logged_at', today + 'T00:00:00')
            .then(({ data }) => ({ type: 'checked_fridges', count: new Set((data ?? []).map(r => r.fridge_id)).size }))
        )
      }

      if (!promises.length) {
        if (!cancelled) setData({ fridgesUnchecked: 0, cleaningDue: 0, loaded: true, closedToday: false })
        return
      }

      const results = await Promise.all(promises)
      if (cancelled) return
      const r = {}
      for (const res of results) r[res.type] = res.count
      setData({
        fridgesUnchecked: Math.max(0, (r.total_fridges ?? 0) - (r.checked_fridges ?? 0)),
        cleaningDue: Math.max(0, (r.total_cleaning ?? 0) - (r.done_cleaning ?? 0)),
        loaded: true,
        closedToday: false,
      })
    }

    return () => { cancelled = true }
  }, [staffId, venueId, isEnabled, hasPermission])

  return data
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StaffDashboardPage() {
  const { venueId, venueSlug } = useVenue()
  const { session, hasPermission, isManager } = useSession()
  const { isEnabled, isPlanLocked } = useVenueFeatures()
  const { closedDays } = useAppSettings()
  const [todayShift, setTodayShift] = useState(null)
  const [hourlyRate, setHourlyRate] = useState(0)
  const [loading, setLoading]       = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')
  const dateLabel = format(new Date(), 'EEEE, d MMMM')

  useEffect(() => {
    if (!session?.staffId || !venueId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [shiftRes, staffRes] = await Promise.all([
          supabase.from('shifts')
            .select('id, start_time, end_time, role_label, shift_date')
            .eq('venue_id', venueId).eq('staff_id', session.staffId).eq('shift_date', today)
            .order('start_time').limit(1),
          supabase.from('staff').select('hourly_rate').eq('id', session.staffId).single(),
        ])
        if (cancelled) return
        setTodayShift(shiftRes.data?.[0] ?? null)
        setHourlyRate(staffRes.data?.hourly_rate ?? 0)
      } catch { /* network error — leave defaults */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [session?.staffId, today, venueId])

  const summary = useTodaySummary({
    staffId: session?.staffId,
    venueId,
    isEnabled,
    hasPermission,
    closedDays,
  })

  if (!session) return null
  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  const hasShift = !!todayShift

  return (
    <div className="flex flex-col gap-3">

      {/* Page header */}
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[10.5px] font-mono tracking-widest uppercase text-charcoal/40 font-semibold">My Shift</span>
        <span className="text-[10.5px] font-mono text-charcoal/35">{dateLabel}</span>
      </div>

      {/* Greeting */}
      {(() => {
        const h = new Date().getHours()
        const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
        const first = session.staffName?.split(' ')[0]
        return (
          <h1 className="text-[26px] font-medium tracking-[-0.025em] text-charcoal leading-tight px-0.5">
            {salutation}{first ? `, ${first}` : ''}
          </h1>
        )
      })()}

      {/* Notifications card — always visible */}
      <NotificationsCard staffId={session.staffId} venueId={venueId} />

      {/* Hero card */}
      {!isPlanLocked('clock-in') && (
        <ShiftHeroCard
          todayShift={todayShift}
          hourlyRate={hourlyRate}
          staffId={session.staffId}
          hasShift={hasShift}
        />
      )}

      {/* If clock-in is locked, show shift info in a simpler card */}
      {isPlanLocked('clock-in') && todayShift && (
        <div className="bg-brand text-white rounded-[14px] p-5">
          <span style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 10.5, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            Your shift today
          </span>
          <div style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 28, fontWeight: 500, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
            {todayShift.start_time.slice(0, 5)} — {todayShift.end_time.slice(0, 5)}
          </div>
          {todayShift.role_label && (
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{todayShift.role_label}</p>
          )}
        </div>
      )}

      {/* Alert strip */}
      {summary.loaded && !summary.closedToday && (
        <AlertStrip
          fridgesUnchecked={summary.fridgesUnchecked}
          cleaningDue={summary.cleaningDue}
          venueSlug={venueSlug}
        />
      )}

      {/* Duties — personal assignment for this shift */}
      <TodayDuties staffId={session.staffId} />

      {/* Opening/closing checks — collapsible, shown when feature is enabled for venue */}
      {isEnabled('opening_closing') && (
        <TodayChecks venueId={venueId} venueSlug={venueSlug} staffName={session.staffName} />
      )}

      {/* Pending training sign-offs */}
      <PendingTrainingCard staffId={session.staffId} staffName={session.staffName} isManager={isManager} />

      {/* Quick log row */}
      <QuickLogRow venueSlug={venueSlug} isEnabled={isEnabled} hasPermission={hasPermission} />

    </div>
  )
}
