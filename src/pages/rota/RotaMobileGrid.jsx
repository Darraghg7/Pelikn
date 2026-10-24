import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { format, addWeeks, isToday, differenceInCalendarWeeks } from 'date-fns'
import { updateShift, insertShift, deleteShift, insertShifts } from '../../lib/api/shifts'
import { useVenue } from '../../contexts/VenueContext'
import { useShifts, useStaffList } from '../../hooks/useShifts'
import { useAppSettings } from '../../hooks/useSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { useAvailability } from '../../hooks/useAvailability'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import { getWeekStart, getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import Toggle from '../../components/ui/Toggle'
import LoadError from '../../components/ui/LoadError'
import Avatar from '../../components/ui/Avatar'
import { shortName } from '../../lib/names'
import Button, { CloseButton } from '../../components/ui/Button'
import { useTheme } from '../../contexts/ThemeContext'
import { colors, white } from '../../lib/tokens'
import { STATION_COLOR, STATION_ORDER, stationFromRole, stationColor, buildRotaWeek, closureDateSet, shiftCost, shiftDurationHours, canPublishWeek, publishButtonLabel, publishRota, approveSwapRequest, declineSwapRequest, isSwapExpired, EXPIRED_SWAP_NOTE } from '../../lib/rota'
import { useRotaPublished } from '../../hooks/useRotaPublished'

// ── Time helpers ──────────────────────────────────────────────────────────────
const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

function fmtT(t) { const [h, m] = t.split(':'); return m === '00' ? h : `${h}:${m}` }
function durLabel(s, e) {
  const [sh, sm] = s.split(':').map(Number)
  const [eh, em] = e.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ── Scroll wheel picker ───────────────────────────────────────────────────────
function Wheel({ values, value, onChange, accent }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const IH = 38, VIS = 5

  const setNode = useCallback((node) => {
    ref.current = node
    if (node) node.scrollTop = Math.max(0, values.indexOf(value)) * IH
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- a callback ref must keep one identity or React detaches/reattaches it each change; it only sets the starting scroll, the effect below follows `value`

  useEffect(() => {
    const el = ref.current; if (!el) return
    el.scrollTop = Math.max(0, values.indexOf(value)) * IH
  }, [value, values])

  const onScroll = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current; if (!el) return
      const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / IH)))
      if (el.scrollTop !== i * IH) el.scrollTo({ top: i * IH, behavior: 'smooth' })
      if (values[i] !== value) onChange(values[i])
    }, 80)
  }, [values, value, onChange])

  const pad = ((VIS - 1) / 2) * IH
  return (
    <div className="relative flex-1" style={{ height: VIS * IH }}>
      <div
        ref={setNode}
        onScroll={onScroll}
        className="overflow-y-scroll [scroll-snap-type:y_mandatory] [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch]"
        style={{ height: VIS * IH, padding: `${pad}px 0` }}
      >
        {values.map((v, i) => {
          const active = v === value
          return (
            <div
              key={v}
              onClick={() => { ref.current?.scrollTo({ top: i * IH, behavior: 'smooth' }); onChange(v) }}
              className={`flex items-center justify-center [scroll-snap-align:center] cursor-pointer font-mono tabular-nums tracking-[-0.02em] transition-[font-size,color] duration-100 ${active ? 'text-ink dark:text-white' : 'text-ink4 dark:text-white/30'}`}
              style={{ height: IH, fontSize: active ? 25 : 19, fontWeight: active ? 600 : 500, color: active && accent ? accent : undefined }}
            >
              {v}
            </div>
          )
        })}
      </div>
      <div className="absolute left-0 right-0 pointer-events-none border-t border-b border-charcoal/10 dark:border-white/10 bg-brand/3 dark:bg-white/5" style={{ top: pad, height: IH }} />
      {/* Fade to the sheet colour (surface, or paperDark in dark mode) */}
      <div className="absolute left-0 right-0 top-0 pointer-events-none bg-gradient-to-b from-surface to-surface/0 dark:from-paperDark dark:to-paperDark/0" style={{ height: pad }} />
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none bg-gradient-to-t from-surface to-surface/0 dark:from-paperDark dark:to-paperDark/0" style={{ height: pad }} />
    </div>
  )
}

// ── Shift Sheet ───────────────────────────────────────────────────────────────
function ShiftSheet({ shift, staffMember, day, venueId, roles, breakDurationMins, onClose, onSaved, onDeleted }) {
  const existing = shift?.id ? shift : null
  const [startH, setStartH] = useState(existing?.start_time?.slice(0, 2) ?? '09')
  const [startM, setStartM] = useState(
    MINUTES.reduce((p, m) => Math.abs(+m - +(existing?.start_time?.slice(3, 5) ?? '0')) < Math.abs(+p - +(existing?.start_time?.slice(3, 5) ?? '0')) ? m : p, '00')
  )
  const [endH, setEndH] = useState(existing?.end_time?.slice(0, 2) ?? '17')
  const [endM, setEndM] = useState(
    MINUTES.reduce((p, m) => Math.abs(+m - +(existing?.end_time?.slice(3, 5) ?? '0')) < Math.abs(+p - +(existing?.end_time?.slice(3, 5) ?? '0')) ? m : p, '00')
  )
  // role_label is NOT NULL in the DB, so always start with one picked
  const [roleLabel, setRoleLabel] = useState(existing?.role_label || staffMember?.job_title || roles[0]?.name || '')
  const [isClosing, setIsClosing] = useState(existing?.is_closing ?? false)
  const [edge, setEdge] = useState('start')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const { venueId: vid } = useVenue()

  const startTime = `${startH}:${startM}`
  const endTime   = `${endH}:${endM}`
  const station   = stationFromRole(roleLabel)
  const { dark } = useTheme()
  // No station: brand green, which is unreadable on the dark sheet, so white there
  const col       = station ? STATION_COLOR[station] : (dark ? white() : colors.brand.DEFAULT)
  const hrs       = shiftDurationHours(startTime, endTime)
  const valid     = hrs > 0 && !!roleLabel
  const rate      = staffMember?.hourly_rate
  const cost      = (rate && valid) ? Math.round(shiftCost(startTime, endTime, staffMember, breakDurationMins)) : null

  const save = async () => {
    setSaving(true)
    const payload = {
      venue_id:   venueId ?? vid,
      staff_id:   staffMember?.id ?? null,
      shift_date: format(day, 'yyyy-MM-dd'),
      week_start: format(getWeekStart(day), 'yyyy-MM-dd'),
      start_time: startTime,
      end_time:   endTime,
      role_label: roleLabel,
      is_closing: isClosing,
    }
    let change
    if (existing) {
      const before = {
        id:         existing.id,
        staff_id:   existing.staff_id ?? null,
        start_time: existing.start_time,
        end_time:   existing.end_time,
        role_label: existing.role_label ?? null,
        is_closing: existing.is_closing ?? false,
      }
      const { error } = await updateShift(existing.id, { start_time: startTime, end_time: endTime, role_label: roleLabel || null, is_closing: isClosing })
      if (error) { setSaving(false); toast(error.message, 'error'); return }
      change = { type: 'edit', before }
    } else {
      const { data, error } = await insertShift(payload)
      if (error) { setSaving(false); toast(error.message, 'error'); return }
      change = { type: 'add', id: data.id }
    }
    setSaving(false)
    toast(existing ? 'Shift updated ✓' : 'Shift added ✓')
    onSaved?.(change)
    onClose()
  }

  const del = async () => {
    if (!existing) { onClose(); return }
    setDeleting(true)
    const { error } = await deleteShift(existing.id)
    setDeleting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Shift removed')
    onDeleted?.({
      type: 'delete',
      before: {
        id:         existing.id,
        venue_id:   existing.venue_id,
        staff_id:   existing.staff_id ?? null,
        shift_date: existing.shift_date,
        week_start: existing.week_start,
        start_time: existing.start_time,
        end_time:   existing.end_time,
        role_label: existing.role_label ?? null,
        is_closing: existing.is_closing ?? false,
      },
    })
    onClose()
  }

  const curH = edge === 'start' ? startH : endH
  const curM = edge === 'start' ? startM : endM
  const setCur = (h, m) => { if (edge === 'start') { setStartH(h); setStartM(m) } else { setEndH(h); setEndM(m) } }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[52] bg-ink/45 [animation:fadeIn_.2s_ease_both]" />
      <div className="fixed bottom-0 left-0 right-0 z-[53] bg-surface dark:bg-paperDark rounded-t-sheet max-h-[90%] flex flex-col [animation:sheetUp_.32s_cubic-bezier(0.16,1,0.3,1)_both] shadow-[0_-12px_40px_theme(colors.ink/22%)]">

        {/* Scrollable form body */}
        <div className="overflow-y-auto px-4 pt-[10px] pb-1 flex-1">
          <div className="w-[38px] h-1 rounded-tag bg-charcoal/10 dark:bg-white/10 mx-auto mb-[14px]" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={staffMember?.name ?? 'Unassigned'} id={staffMember?.id} colour={staffMember?.colour} photoUrl={staffMember?.photo_url} tone={staffMember ? 'person' : 'neutral'} size="xl" decorative />
            <div className="flex-1 min-w-0">
              <div className="text-title-sm font-semibold tracking-[-0.015em] text-charcoal dark:text-white">{staffMember?.name ?? 'Unassigned'}</div>
              <div className="text-xs text-charcoal/50 dark:text-white/40 mt-px">{roleLabel || staffMember?.job_title || ''} · {format(day, 'EEE d MMM')}</div>
            </div>
            <CloseButton onClick={onClose} />
          </div>

          {/* Closing shift */}
          <div className="flex items-center justify-between gap-3 rounded-control border border-charcoal/10 dark:border-white/10 px-3 py-2.5 mb-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-charcoal dark:text-white">Closing shift</div>
              <div className="text-[10.5px] text-charcoal/50 dark:text-white/40 mt-0.5 leading-snug">
                They'll see their department's closing tasks — first to clock out checks them off, anyone after has to acknowledge it's done.
              </div>
            </div>
            <Toggle aria-label="Closing shift" checked={isClosing} onChange={() => setIsClosing((v) => !v)} />
          </div>

          {/* Start / End toggle */}
          <div className="flex gap-2 bg-charcoal/[0.06] dark:bg-white/[0.06] p-1 rounded-control mb-3">
            {[['start', 'Start', startTime], ['end', 'End', endTime]].map(([k, lbl, val]) => {
              const on = edge === k
              return (
                <button
                  key={k}
                  onClick={() => setEdge(k)}
                  className={`flex-1 cursor-pointer border-none rounded-control py-[7px] ${on ? 'bg-paper dark:bg-white/15 shadow-[0_1px_3px_theme(colors.ink/10%)]' : 'bg-transparent'}`}
                >
                  <div className="font-mono text-[9px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.06em] font-semibold">{lbl}</div>
                  <div className={`font-mono text-title-sm font-semibold mt-0.5 tabular-nums ${on ? '' : 'text-ink3 dark:text-white/45'}`} style={{ color: on ? col : undefined }}>{val}</div>
                </button>
              )
            })}
          </div>

          {/* Wheels */}
          <div className="flex items-center gap-1 mb-[6px]">
            <Wheel values={HOURS}   value={curH} onChange={(h) => setCur(h, curM)} accent={col} />
            <span className="font-mono text-title font-semibold text-charcoal/50 dark:text-white/40 pb-0.5">:</span>
            <Wheel values={MINUTES} value={curM} onChange={(m) => setCur(curH, m)} accent={col} />
          </div>

          {/* Summary */}
          <div className="px-[13px] py-[11px] rounded-control flex items-center gap-2 justify-center flex-wrap mb-[14px]" style={{ background: col + '14' }}>
            <span className="font-mono text-sm font-semibold text-charcoal dark:text-white tabular-nums">{startTime}–{endTime}</span>
            <span className={`text-body-sm ${hrs > 0 ? 'text-charcoal/50 dark:text-white/40' : 'text-danger'}`}>· {hrs > 0 ? durLabel(startTime, endTime) + (endTime < startTime ? ' · ends next day' : '') : 'start and end are the same'}</span>
            {valid && cost != null && <span className="font-mono text-body-sm text-charcoal/50 dark:text-white/40">· ~£{cost}</span>}
          </div>

          {/* Role chips */}
          {roles.length > 0 && (
            <div className="mb-2">
              <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.07em] font-semibold mb-2">Role</div>
              <div className="flex flex-wrap gap-[6px]">
                {roles.map((r) => {
                  const on = roleLabel === r.name
                  return (
                    <button key={r.id} onClick={() => setRoleLabel(r.name)} className={`cursor-pointer text-xs font-medium px-3 py-[6px] rounded-full border ${on ? 'border-brand bg-brand text-white' : 'border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark text-charcoal/75 dark:text-white/60'}`}>{r.name}</button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer — always visible regardless of form scroll position */}
        <div className="px-4 border-t border-charcoal/[0.06] dark:border-white/10 bg-surface dark:bg-paperDark shrink-0" style={{ paddingTop: 12, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2">
            {existing && (
              <Button variant="danger-ghost" size="lg" iconOnly loading={deleting} aria-label="Delete shift" onClick={del} disabled={deleting}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </Button>
            )}
            <Button
              size="lg"
              loading={saving}
              onClick={save}
              disabled={saving || !valid}
              className="flex-1"
            >
              {existing ? 'Save changes' : 'Add to rota'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Swap Sheet ────────────────────────────────────────────────────────────────
function SwapSheet({ swaps, onClose, onResolved }) {
  const [resolving, setResolving] = useState(null)
  const toast = useToast()
  const { venueId } = useVenue()
  const pending = swaps.filter(s => s.status === 'pending')

  const approve = async (swap) => {
    setResolving(swap.id)
    const { error } = await approveSwapRequest(swap, venueId)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap approved ✓')
    onResolved()
  }

  const decline = async (swap) => {
    setResolving(swap.id)
    // A swap for a shift that has already passed can only be dismissed, and says why.
    const passed = isSwapExpired(swap)
    const { error } = await declineSwapRequest(swap, venueId, passed ? EXPIRED_SWAP_NOTE : null)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast(passed ? 'Expired swap request dismissed' : 'Swap declined')
    onResolved()
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[52] bg-ink/45 [animation:fadeIn_.2s_ease_both]" />
      <div className="fixed bottom-0 left-0 right-0 z-[53] bg-surface dark:bg-paperDark rounded-t-sheet max-h-[80%] flex flex-col [animation:sheetUp_.32s_cubic-bezier(0.16,1,0.3,1)_both] shadow-[0_-12px_40px_theme(colors.ink/22%)]">
        <div className="px-4 pt-[10px]">
          <div className="w-[38px] h-1 rounded-tag bg-charcoal/10 dark:bg-white/10 mx-auto mb-[14px]" />
          <div className="text-title-sm font-semibold tracking-[-0.015em] text-charcoal dark:text-white">Swap requests</div>
          <div className="text-body-sm text-charcoal/50 dark:text-white/40 mt-0.5 mb-[14px]">{pending.length ? `${pending.length} pending your approval` : 'All caught up'}</div>
        </div>
        <div className="overflow-y-auto flex-1 px-4" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}>
          {pending.length === 0 ? (
            <div className="py-7 text-center">
              <div className="w-11 h-11 rounded-control bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="text-charcoal/50 dark:text-white/40 text-body-sm">No swaps waiting.</div>
            </div>
          ) : pending.map(swap => (
            <div key={swap.id} className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-card px-[14px] py-[13px] mb-[10px]">
              <div className="text-body font-semibold text-charcoal dark:text-white">{swap.requester_name ?? 'Staff'} → {swap.target_staff_name ?? 'Staff'}</div>
              {swap.shift && (
                <div className="font-mono text-[10px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.03em] mt-1">
                  {format(new Date(swap.shift.shift_date + 'T00:00:00'), 'EEE d MMM')} · {swap.shift.start_time?.slice(0, 5)}–{swap.shift.end_time?.slice(0, 5)}
                  {isSwapExpired(swap) && ' · shift has passed'}
                </div>
              )}
              {swap.message && <div className="text-body-sm text-charcoal/75 dark:text-white/60 italic mt-2">"{swap.message}"</div>}
              {/* A swap for a shift that has already happened can only be dismissed */}
              {isSwapExpired(swap) ? (
                <div className="flex gap-2 mt-3">
                  <Button variant="secondary" size="sm" onClick={() => decline(swap)} disabled={resolving === swap.id} className="flex-1">{resolving === swap.id ? '…' : 'Dismiss'}</Button>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <Button variant="secondary" size="sm" onClick={() => decline(swap)} disabled={resolving === swap.id} className="flex-1">Decline</Button>
                  <Button variant="success" size="sm" onClick={() => approve(swap)} disabled={resolving === swap.id} className="flex-[2]">{resolving === swap.id ? '…' : 'Approve'}</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────
const CARD = 'bg-white dark:bg-paperDark rounded-card border border-line dark:border-white/10'
const SECTION = 'font-mono text-caption font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 px-1'

/** 16.1 → "16.1h", 16 → "16h" */
function hrs(n) { return `${Math.round(n * 10) / 10}h` }
function money(n) { return `£${Math.round(n)}` }

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className={`${CARD} p-1 flex gap-1 shrink-0`}>
      {options.map(([v, text]) => {
        const on = value === v
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={`h-7 px-3 rounded-control text-body-sm font-semibold transition-colors ${on ? 'bg-brand text-white' : 'text-ink2 dark:text-white/65 hover:text-ink dark:hover:text-white'}`}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}

const CHEVRON_L = <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
const CHEVRON_R = <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
const PLUS = <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>

// ── Week grid cell ────────────────────────────────────────────────────────────
function WeekCell({ shifts, closed, onLeave, onTap, onTapShift, label }) {
  // A closed day takes no shifts, same as the desktop rota.
  if (closed) {
    return (
      <div className="flex-1 min-w-0 p-[3px]">
        <div className="h-[46px] flex items-center justify-center">
          <span className="font-mono text-[9px] text-ink4 dark:text-white/25 uppercase tracking-widest" title="Closed">—</span>
        </div>
      </div>
    )
  }
  // Approved time off blocks the slot: no tap target, so nobody gets rota'd
  // onto a day they have booked off.
  if (!shifts.length && onLeave) {
    return (
      <div className="flex-1 min-w-0 p-[3px]">
        <div className="h-[46px] rounded-control bg-line2 dark:bg-white/10 flex items-center justify-center">
          <span className="font-mono text-[9px] font-semibold tracking-[0.04em] uppercase text-ink3 dark:text-white/45">Leave</span>
        </div>
      </div>
    )
  }
  if (!shifts.length) {
    return (
      <button type="button" onClick={onTap} aria-label={`Add shift, ${label}`} className="flex-1 min-w-0 p-[3px] group">
        <span className="h-[46px] flex items-center justify-center">
          <span className="w-6 h-6 rounded-tag border border-dashed border-ink4/70 dark:border-white/25 text-ink4 dark:text-white/35 flex items-center justify-center group-hover:border-ink3 group-hover:text-ink3">
            {PLUS}
          </span>
        </span>
      </button>
    )
  }
  // One shift fills the cell. A split day gives every shift its own compact
  // chip, stacked in the same cell height.
  const multi = shifts.length > 1
  return (
    <div className="flex-1 min-w-0 p-[3px]">
      <div className={`h-[46px] ${multi ? 'flex flex-col gap-[2px]' : ''}`}>
        {shifts.map((shift) => {
          const col = stationColor(shift.role_label)
          const start = fmtT(shift.start_time.slice(0, 5))
          const end   = fmtT(shift.end_time.slice(0, 5))
          return (
            <button
              key={shift.id}
              type="button"
              onClick={() => onTapShift(shift)}
              aria-label={`${label}, ${start} to ${end}`}
              className={`relative w-full flex items-center justify-center ${multi
                ? 'flex-1 min-h-0 rounded-tag font-mono text-[9px] font-bold tabular-nums tracking-[-0.04em] leading-none whitespace-nowrap overflow-hidden'
                : 'h-[46px] rounded-control flex-col leading-none'}`}
              style={{ background: col + '1f', color: col }}
            >
              {multi ? `${start}–${end}` : (
                <>
                  <span className="font-mono text-caption font-bold tabular-nums tracking-[-0.03em]">{start}</span>
                  <span className="font-mono text-micro font-medium tabular-nums tracking-[-0.03em] opacity-75 mt-[3px]">{end}</span>
                </>
              )}
              {shift._hasSwap && <span className={`absolute rounded-full bg-warn ${multi ? 'top-0.5 right-0.5 w-1 h-1' : 'top-1 right-1 w-1.5 h-1.5'}`} title="Swap requested" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekGrid({ week, showCost, onTap }) {
  const { days, staff } = week
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex border-b border-line dark:border-white/10 px-1">
        <div className="w-[68px] shrink-0" />
        {days.map(({ date: day, closed }, i) => {
          const today = isToday(day)
          return (
            <div key={i} className="flex-1 min-w-0 p-[3px]">
              <div className={`rounded-control py-1.5 text-center ${today ? 'bg-line2 dark:bg-white/10' : ''}`}>
                <div className="font-mono text-[10px] font-semibold tracking-[0.04em] uppercase text-ink3 dark:text-white/45">{format(day, 'EEE')}</div>
                <div className={`text-body-lg font-bold leading-tight mt-0.5 ${today ? 'text-accent' : closed ? 'text-ink4 dark:text-white/25' : 'text-ink dark:text-white'}`}>{format(day, 'd')}</div>
              </div>
            </div>
          )
        })}
      </div>

      {staff.map((member) => {
        const total = week.personTotals(member.id)
        return (
          <div key={member.id} className="flex items-center border-b border-line dark:border-white/10 px-1">
            <div className="w-[68px] shrink-0 pl-2 pr-1 min-w-0">
              <div className="text-body-sm font-semibold text-ink dark:text-white truncate" title={member.name}>{shortName(member.name) || '—'}</div>
              <div className="font-mono text-micro text-ink3 dark:text-white/45 mt-0.5">{showCost ? money(total.cost) : hrs(total.paidHours)}</div>
            </div>
            {days.map((day, di) => {
              const cell = week.cell(member.id, day.dateStr)
              return (
                <WeekCell
                  key={di}
                  shifts={cell.shifts}
                  closed={cell.closed}
                  onLeave={cell.isTimeOff}
                  label={`${member.name}, ${format(day.date, 'EEEE d MMMM')}`}
                  onTap={() => onTap(null, member, day.date)}
                  onTapShift={(shift) => onTap(shift, member, day.date)}
                />
              )
            })}
          </div>
        )
      })}

      <div className="flex items-center bg-cream/60 dark:bg-white/5 px-1 py-2">
        <div className="w-[68px] shrink-0 pl-2 font-mono text-micro font-semibold tracking-[0.06em] uppercase text-ink3 dark:text-white/45">{showCost ? 'Cost' : 'Hours'}</div>
        {week.dayTotals.map((t, i) => (
          <div key={i} className="flex-1 min-w-0 text-center">
            <div className="text-body-sm font-bold text-ink dark:text-white tabular-nums">{showCost ? money(t.cost) : hrs(t.paidHours)}</div>
            <div className="font-mono text-[10px] uppercase text-ink3 dark:text-white/45 mt-0.5">{t.heads} on</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────
function DayView({ week, dayIndex, setDayIndex, shifts, breakDurationMins, showCost, onTap }) {
  const { staff } = week
  const days = week.days.map((d) => d.date)
  const day = days[dayIndex]
  const dateStr = format(day, 'yyyy-MM-dd')
  const dayClosed = week.days[dayIndex].closed
  const dayTotal = week.dayTotals[dayIndex]
  const onShift = shifts
    .filter(s => s.shift_date === dateStr && s.staff_id)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const scheduledIds = new Set(onShift.map(s => s.staff_id))
  const onLeave = staff.filter(m => !scheduledIds.has(m.id) && week.cell(m.id, dateStr).isTimeOff)
  const leaveIds = new Set(onLeave.map(m => m.id))
  const free = staff.filter(m => !scheduledIds.has(m.id) && !leaveIds.has(m.id))

  return (
    <>
      <div className="flex gap-1.5">
        {days.map((d, i) => {
          const on = i === dayIndex
          return (
            <button
              key={i}
              type="button"
              onClick={() => setDayIndex(i)}
              aria-pressed={on}
              aria-label={format(d, 'EEEE d MMMM')}
              className={`flex-1 min-w-0 rounded-control border py-2 text-center transition-colors ${on ? 'bg-brand border-brand text-white' : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink dark:text-white'}`}
            >
              <div className={`font-mono text-[10px] font-semibold uppercase tracking-[0.04em] ${on ? 'text-white/70' : 'text-ink3 dark:text-white/45'}`}>{format(d, 'EEE')}</div>
              <div className="text-body-lg font-bold leading-tight mt-0.5">{format(d, 'd')}</div>
              <div className={`font-mono text-[10px] mt-0.5 ${on ? 'text-white/70' : 'text-ink3 dark:text-white/45'}`}>{showCost ? money(week.dayTotals[i].cost) : hrs(week.dayTotals[i].paidHours)}</div>
            </button>
          )
        })}
      </div>

      <div className="flex items-baseline justify-between px-1 pt-1">
        <h2 className="text-body-lg font-bold text-ink dark:text-white">{format(day, 'EEEE d MMM')}</h2>
        <span className="text-caption text-ink3 dark:text-white/45">{dayClosed ? 'Closed' : `${dayTotal.heads} on · ${showCost ? money(dayTotal.cost) : hrs(dayTotal.paidHours)}`}</span>
      </div>

      {dayClosed ? (
        <div className={`${CARD} px-4 py-5 text-center text-body-sm text-ink3 dark:text-white/45`}>Closed — no shifts on this day.</div>
      ) : onShift.length === 0 ? (
        <div className={`${CARD} px-4 py-5 text-center text-body-sm text-ink3 dark:text-white/45`}>Nobody on yet. Add a shift below.</div>
      ) : (
        <div className={`${CARD} overflow-hidden divide-y divide-line dark:divide-white/10`}>
          {onShift.map(s => {
            const member = staff.find(m => m.id === s.staff_id) ?? s.staff ?? { id: s.staff_id, name: 'Staff' }
            const col = stationColor(s.role_label)
            const start = fmtT(s.start_time.slice(0, 5))
            const end   = fmtT(s.end_time.slice(0, 5))
            return (
              <button key={s.id} type="button" onClick={() => onTap(s, member, day)} className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-cream/60 dark:hover:bg-white/5">
                <span className="w-[3px] self-stretch rounded-full shrink-0" style={{ background: col }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-body-sm font-semibold text-ink dark:text-white truncate">{member.name}</span>
                  <span className="block text-caption text-ink3 dark:text-white/45 mt-0.5 truncate">{s.role_label || member.job_title || '—'}</span>
                </span>
                <span className="shrink-0 rounded-control px-2.5 py-1.5 text-right" style={{ background: col + '1f', color: col }}>
                  <span className="block font-mono text-body-sm font-bold tabular-nums tracking-[-0.02em]">{start}–{end}</span>
                  <span className="block font-mono text-micro opacity-75 mt-0.5">{showCost && member.hourly_rate ? money(shiftCost(s.start_time, s.end_time, member, breakDurationMins)) : hrs(shiftDurationHours(s.start_time, s.end_time))}</span>
                </span>
                {s._hasSwap && <span className="w-1.5 h-1.5 rounded-full bg-warn shrink-0" title="Swap requested" />}
              </button>
            )
          })}
        </div>
      )}

      {!dayClosed && onLeave.length > 0 && (
        <>
          <p className={`${SECTION} pt-1`}>On leave</p>
          <div className={`${CARD} overflow-hidden divide-y divide-line dark:divide-white/10`}>
            {onLeave.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                <span className="text-body-sm font-semibold text-ink dark:text-white truncate">{m.name}</span>
                <span className="shrink-0 h-6 px-2.5 rounded-full bg-line2 dark:bg-white/10 inline-flex items-center text-caption font-semibold text-ink2 dark:text-white/65">Leave</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!dayClosed && free.length > 0 && (
        <>
          <p className={`${SECTION} pt-1`}>Not scheduled · {free.length}</p>
          <div className={`${CARD} overflow-hidden divide-y divide-line dark:divide-white/10`}>
            {free.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-3.5 py-2">
                <Avatar name={m.name} id={m.id} colour={m.colour} photoUrl={m.photo_url} size="sm" decorative />
                <span className="flex-1 min-w-0">
                  <span className="block text-body-sm font-semibold text-ink dark:text-white truncate">{shortName(m.name) || '—'}</span>
                  <span className="block text-caption text-ink3 dark:text-white/45 mt-0.5">{showCost ? `${money(week.personTotals(m.id).cost)} this week` : `${hrs(week.personTotals(m.id).paidHours)} this week`}</span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onTap(null, m, day)}
                  aria-label={`Add shift for ${m.name}`}
                >
                  {PLUS} Shift
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function StationLegend() {
  return (
    <div className="flex items-center gap-4 px-1 flex-wrap">
      {STATION_ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-caption text-ink3 dark:text-white/45">
          <span className="w-2 h-2 rounded-full" style={{ background: STATION_COLOR[s] }} />{s}
        </span>
      ))}
    </div>
  )
}

// ── RotaMobileGrid ────────────────────────────────────────────────────────────
export default function RotaMobileGrid() {
  const { venueId } = useVenue()
  const toast = useToast()

  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const days = getWeekDays(weekStart)
  const weekOffset = differenceInCalendarWeeks(weekStart, getWeekStart(), { weekStartsOn: 1 })
  const weekTitle = weekOffset === 0 ? 'This week'
    : weekOffset === 1 ? 'Next week'
    : weekOffset === -1 ? 'Last week'
    : weekOffset > 1 ? `In ${weekOffset} weeks` : `${-weekOffset} weeks ago`

  const [view, setView]         = useState('week')
  const [dayIndex, setDayIndex] = useState(() => { const i = getWeekDays(getWeekStart()).findIndex(d => isToday(d)); return i < 0 ? 0 : i })
  const [shiftSheet, setShiftSheet] = useState(null)
  const [showSwaps, setShowSwaps]   = useState(false)
  const [showCost, setShowCost]     = useState(false)
  // Unpublished edits made this session, newest last. Each entry lets Discard
  // undo the change: { type: 'add', id } | { type: 'edit', before } | { type: 'delete', before }
  // Kept per week: changing week used to wipe the list, so an edited published
  // week could not be re-published after looking at another week.
  const [changesByWeek, setChangesByWeek] = useState({})
  const [publishing, setPublishing] = useState(false)
  const [reverting, setReverting]   = useState(false)
  const weekKey = format(weekStart, 'yyyy-MM-dd')
  const sessionChanges = changesByWeek[weekKey] ?? []
  const setSessionChanges = (next) => setChangesByWeek(all => ({
    ...all,
    [weekKey]: typeof next === 'function' ? next(all[weekKey] ?? []) : next,
  }))
  const pendingChanges = sessionChanges.length

  const { shifts, loading, isError: shiftsFailed, reload } = useShifts(weekStart, 1)
  const { staff, loading: staffLoading, isError: staffFailed, reload: reloadStaff } = useStaffList()
  const { unavailability } = useAvailability(weekStart, 1)
  const { swaps, pendingCount, reload: reloadSwaps } = useShiftSwaps()
  const { roles } = useVenueRoles()
  const { closedDays, breakDurationMins } = useAppSettings()
  const { closures } = useVenueClosures()
  const closedDates = useMemo(() => closureDateSet(closures), [closures])

  const { published: dbPublished, markPublished } = useRotaPublished(weekStart)

  const goWeek = (n) => {
    const w = addWeeks(weekStart, n)
    setWeekStart(w)
    const i = getWeekDays(w).findIndex(d => isToday(d))
    setDayIndex(i < 0 ? 0 : i)
  }

  const swapShiftIds = new Set(swaps.filter(s => s.status === 'pending').map(s => s.shift_id))
  const weekShifts = shifts.map(s => ({ ...s, _hasSwap: swapShiftIds.has(s.id) }))

  // The same week model the desktop rota uses: shifts by person and day,
  // closed days, paid hours and cost with the venue's break rules.
  const week = useMemo(
    () => buildRotaWeek({ weekStart, shifts: weekShifts, staff, unavailability, closedDays, closedDates, breakDurationMins }),
    [weekStart, shifts, swaps, staff, unavailability, closedDays, closedDates, breakDurationMins], // eslint-disable-line react-hooks/exhaustive-deps -- weekShifts is derived from shifts and swaps
  )

  const weekHours = week.dayTotals.reduce((a, t) => a + t.paidHours, 0)
  const weekCost  = week.dayTotals.reduce((a, t) => a + t.cost, 0)

  // Publishing is only possible when there is something new for staff to see:
  // unpublished edits this session, or a week with shifts that was never published.
  const canPublish = canPublishWeek({ pendingChanges, publishedState: dbPublished, shiftCount: shifts.length })

  const publish = async () => {
    if (!canPublish) return
    setPublishing(true)
    const { error } = await publishRota({ venueId, weekStartStr: format(weekStart, 'yyyy-MM-dd'), shifts })
    setPublishing(false)
    if (error) { toast(error.message, 'error'); return }
    setSessionChanges([])
    markPublished()
    toast('Rota published — everyone notified ✓')
  }

  // Discard every unpublished change this session by reversing each in LIFO order:
  // added shifts are deleted, edits are restored, deletions are re-inserted.
  const discardChanges = async () => {
    if (reverting || sessionChanges.length === 0) return
    setReverting(true)
    for (const ch of [...sessionChanges].reverse()) {
      if (ch.type === 'add') {
        await deleteShift(ch.id)
      } else if (ch.type === 'edit') {
        const b = ch.before
        await updateShift(b.id, { staff_id: b.staff_id, start_time: b.start_time, end_time: b.end_time, role_label: b.role_label, is_closing: b.is_closing })
      } else if (ch.type === 'delete') {
        await insertShifts([ch.before])
      }
    }
    setSessionChanges([])
    setReverting(false)
    reload()
    toast('Changes discarded')
  }

  const handleChange = (change) => { if (change) setSessionChanges(c => [...c, change]); reload() }
  const openSheet = (shift, staffMember, day) => setShiftSheet({ shift, staffMember, day })
  const isLoading = loading || staffLoading
  // An empty grid from a failed read looks like a week with nothing on it.
  const loadFailed = shiftsFailed || staffFailed

  const publishLabel = publishButtonLabel({ publishing, canPublish, publishedState: dbPublished })

  return (
    <div className="flex flex-col gap-2.5">
      <style>{`
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn  { from { opacity: 0; }                 to { opacity: 1; } }
      `}</style>

      {/* Header — Publish lives top right and only wakes up when there's something to send */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title leading-tight font-bold tracking-tight text-ink dark:text-white">Rota</h1>
        <div className="flex items-center gap-2">
          {pendingChanges > 0 && (
            <Button
              variant="ghost"
              size="sm"
              loading={reverting}
              onClick={discardChanges}
              disabled={publishing || reverting}
            >
              {reverting ? 'Undoing…' : 'Discard'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={publish}
            disabled={!canPublish || publishing || reverting}
            title={canPublish ? (pendingChanges ? `${pendingChanges} unpublished ${pendingChanges === 1 ? 'change' : 'changes'}` : 'Staff can’t see this week yet') : undefined}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            {publishLabel}
            {pendingChanges > 0 && !publishing && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 inline-flex items-center justify-center text-micro font-bold">{pendingChanges}</span>}
          </Button>
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => goWeek(-1)} aria-label="Previous week" className={`${CARD} w-11 shrink-0 flex items-center justify-center text-ink2 dark:text-white/70 hover:text-ink`}>{CHEVRON_L}</button>
        <div className={`${CARD} flex-1 min-w-0 py-2 text-center`}>
          <div className="text-body-lg font-bold text-ink dark:text-white">{weekTitle}</div>
          <div className="font-mono text-micro tracking-[0.06em] uppercase text-ink3 dark:text-white/45 mt-0.5">
            {format(days[0], 'd MMM')} – {format(days[6], 'd MMM')} · {showCost ? money(weekCost) : hrs(weekHours)}
          </div>
        </div>
        <button type="button" onClick={() => goWeek(1)} aria-label="Next week" className={`${CARD} w-11 shrink-0 flex items-center justify-center text-ink2 dark:text-white/70 hover:text-ink`}>{CHEVRON_R}</button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Segmented label="View" options={[['week', 'Week'], ['day', 'Day']]} value={view} onChange={setView} />
        <div className="flex-1" />
        <Segmented label="Show" options={[[false, 'Hours'], [true, '£']]} value={showCost} onChange={setShowCost} />
      </div>

      {/* Swap requests */}
      {pendingCount > 0 && (
        <button type="button" onClick={() => setShowSwaps(true)} className="w-full flex items-center gap-3 px-3.5 py-2 rounded-card bg-warnBg dark:bg-warn/15 text-left">
          <span className="w-2 h-2 rounded-full bg-warn shrink-0" />
          <span className="flex-1 text-body-sm font-semibold text-warn">{pendingCount} swap {pendingCount === 1 ? 'request' : 'requests'} pending</span>
          <span className="text-body-sm font-semibold text-warn inline-flex items-center gap-0.5">Review {CHEVRON_R}</span>
        </button>
      )}

      {isLoading ? (
        <div className={`${CARD} h-[240px] animate-pulse`} />
      ) : loadFailed ? (
        <LoadError what="the rota" onRetry={() => { reload(); reloadStaff() }} className={CARD} />
      ) : view === 'week' ? (
        <WeekGrid week={week} showCost={showCost} onTap={openSheet} />
      ) : (
        <DayView
          week={week}
          dayIndex={dayIndex}
          setDayIndex={setDayIndex}
          shifts={weekShifts}
          breakDurationMins={breakDurationMins}
          showCost={showCost}
          onTap={openSheet}
        />
      )}

      {!isLoading && <StationLegend />}

      {/* ── Sheets ── */}
      {shiftSheet && (
        <ShiftSheet
          shift={shiftSheet.shift}
          staffMember={shiftSheet.staffMember}
          day={shiftSheet.day}
          venueId={venueId}
          roles={roles}
          breakDurationMins={breakDurationMins}
          onClose={() => setShiftSheet(null)}
          onSaved={handleChange}
          onDeleted={handleChange}
        />
      )}
      {showSwaps && (
        <SwapSheet
          swaps={swaps}
          onClose={() => setShowSwaps(false)}
          onResolved={() => { reloadSwaps(); reload() }}
        />
      )}
    </div>
  )
}
