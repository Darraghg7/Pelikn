import React, { useState, useRef, useCallback, useEffect } from 'react'
import { format, addWeeks, subWeeks, isToday, differenceInCalendarWeeks } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useShifts, useStaffList, shiftDurationHours, paidShiftHours } from '../../hooks/useShifts'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import { getWeekStart, getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../contexts/AuthContext'
import NotificationBell from '../../components/notifications/NotificationBell'

const STATION_COLOR = { Kitchen: '#b5701f', FOH: '#2d7d6e', Bar: '#7a5ea8', KP: '#4f6d8a' }
const STATION_AVATAR = {
  Kitchen: { bg: '#f0ebde', fg: '#6b5028' },
  FOH:     { bg: '#e7eef3', fg: '#2a4a66' },
  Bar:     { bg: '#eaeae6', fg: '#3a3a30' },
  KP:      { bg: '#ecdfe1', fg: '#5a3036' },
}
const STATION_ORDER = ['Kitchen', 'FOH', 'Bar', 'KP']

function stationFromRole(role) {
  if (!role) return null
  const r = role.toLowerCase()
  if (r.includes('kitchen') || r.includes('chef') || r.includes('cook')) return 'Kitchen'
  if (r.includes('kp') || r.includes('porter')) return 'KP'
  if (r.includes('bar') || r.includes('barista')) return 'Bar'
  if (r.includes('foh') || r.includes('floor') || r.includes('server') || r.includes('host') || r.includes('supervisor')) return 'FOH'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// Column widths — matches design exactly
const NAME_W = 92
const DAY_COL = 76
const ROW_H   = 56

// ── Time helpers ──────────────────────────────────────────────────────────────
const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
const PRESETS = [
  { label: 'Open',   s: '07:00', e: '15:00' },
  { label: 'Mid',    s: '11:00', e: '19:00' },
  { label: 'Close',  s: '16:00', e: '23:30' },
  { label: 'Double', s: '09:00', e: '21:00' },
]

function fmtT(t) { const [h, m] = t.split(':'); return m === '00' ? h : `${h}:${m}` }
function fmtRange(s, e) { return `${fmtT(s)}–${fmtT(e)}` }
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
  }, []) // eslint-disable-line

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
              className="flex items-center justify-center [scroll-snap-align:center] cursor-pointer font-mono tabular-nums tracking-[-0.02em] transition-[font-size,color] duration-100"
              style={{ height: IH, fontSize: active ? 25 : 19, fontWeight: active ? 600 : 500, color: active ? (accent || '#0d1a14') : '#b3b9b5' }}
            >
              {v}
            </div>
          )
        })}
      </div>
      <div className="absolute left-0 right-0 pointer-events-none border-t border-b border-charcoal/10" style={{ top: pad, height: IH, background: 'rgba(19,54,42,0.03)' }} />
      <div className="absolute left-0 right-0 top-0 pointer-events-none" style={{ height: pad, background: 'linear-gradient(#f3f3ef, #f3f3ef00)' }} />
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none" style={{ height: pad, background: 'linear-gradient(#f3f3ef00, #f3f3ef)' }} />
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, station, size = 28 }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('')
  const av = STATION_AVATAR[station] || { bg: '#eef4f0', fg: '#13362a' }
  return (
    <span
      className="shrink-0 flex items-center justify-center font-mono font-semibold"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: av.bg, color: av.fg, fontSize: size * 0.32 }}
    >
      {initials}
    </span>
  )
}

// ── Shift Sheet ───────────────────────────────────────────────────────────────
function ShiftSheet({ shift, staffMember, day, venueId, roles, onClose, onSaved, onDeleted }) {
  const existing = shift?.id ? shift : null
  const [startH, setStartH] = useState(existing?.start_time?.slice(0, 2) ?? '09')
  const [startM, setStartM] = useState(
    MINUTES.reduce((p, m) => Math.abs(+m - +(existing?.start_time?.slice(3, 5) ?? '0')) < Math.abs(+p - +(existing?.start_time?.slice(3, 5) ?? '0')) ? m : p, '00')
  )
  const [endH, setEndH] = useState(existing?.end_time?.slice(0, 2) ?? '17')
  const [endM, setEndM] = useState(
    MINUTES.reduce((p, m) => Math.abs(+m - +(existing?.end_time?.slice(3, 5) ?? '0')) < Math.abs(+p - +(existing?.end_time?.slice(3, 5) ?? '0')) ? m : p, '00')
  )
  const [roleLabel, setRoleLabel] = useState(existing?.role_label ?? staffMember?.job_role ?? '')
  const [edge, setEdge] = useState('start')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()
  const { venueId: vid } = useVenue()

  const startTime = `${startH}:${startM}`
  const endTime   = `${endH}:${endM}`
  const station   = stationFromRole(roleLabel)
  const col       = station ? STATION_COLOR[station] : '#13362a'
  const hrs       = shiftDurationHours(startTime, endTime)
  const valid     = hrs > 0
  const rate      = staffMember?.hourly_rate
  const cost      = (rate && valid) ? Math.round(paidShiftHours(startTime, endTime) * rate) : null

  const applyPreset = (p) => {
    setStartH(p.s.slice(0, 2)); setStartM(p.s.slice(3, 5))
    setEndH(p.e.slice(0, 2));   setEndM(p.e.slice(3, 5))
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      venue_id:   venueId ?? vid,
      staff_id:   staffMember?.id ?? null,
      shift_date: format(day, 'yyyy-MM-dd'),
      week_start: format(getWeekStart(day), 'yyyy-MM-dd'),
      start_time: startTime,
      end_time:   endTime,
      role_label: roleLabel || null,
    }
    let error
    if (existing) {
      ;({ error } = await supabase.from('shifts').update({ start_time: startTime, end_time: endTime, role_label: roleLabel || null }).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('shifts').insert(payload))
    }
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(existing ? 'Shift updated ✓' : 'Shift added ✓')
    onSaved?.()
    onClose()
  }

  const del = async () => {
    if (!existing) { onClose(); return }
    setDeleting(true)
    const { error } = await supabase.from('shifts').delete().eq('id', existing.id)
    setDeleting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Shift removed')
    onDeleted?.()
    onClose()
  }

  const curH = edge === 'start' ? startH : endH
  const curM = edge === 'start' ? startM : endM
  const setCur = (h, m) => { if (edge === 'start') { setStartH(h); setStartM(m) } else { setEndH(h); setEndM(m) } }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[52] [animation:fadeIn_.2s_ease_both]" style={{ background: 'rgba(9,18,13,0.42)' }} />
      <div className="fixed bottom-0 left-0 right-0 z-[53] bg-surface rounded-t-[22px] max-h-[90%] flex flex-col [animation:sheetUp_.32s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ boxShadow: '0 -12px 40px rgba(9,18,13,0.22)' }}>

        {/* Scrollable form body */}
        <div className="overflow-y-auto px-4 pt-[10px] pb-1 flex-1">
          <div className="w-[38px] h-1 rounded-sm bg-charcoal/10 mx-auto mb-[14px]" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={staffMember?.name} station={station} size={44} />
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-semibold tracking-[-0.015em] text-charcoal">{staffMember?.name ?? 'Unassigned'}</div>
              <div className="text-xs text-charcoal/50 mt-px">{roleLabel || staffMember?.job_role || ''} · {format(day, 'EEE d MMM')}</div>
            </div>
            <button onClick={onClose} className="bg-charcoal/[0.06] border-none rounded-full w-8 h-8 flex items-center justify-center cursor-pointer shrink-0 text-charcoal/50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Presets */}
          <div className="flex gap-[7px] mb-3">
            {PRESETS.map((p) => {
              const on = startTime === p.s && endTime === p.e
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="flex-1 cursor-pointer rounded-[10px] py-[7px] px-0.5 border"
                  style={{ borderColor: on ? col : '#e4e6e2', background: on ? col : '#ffffff', color: on ? '#fff' : '#3d4a44' }}
                >
                  <div className="text-xs font-semibold">{p.label}</div>
                  <div className="font-mono text-[8.5px] mt-px" style={{ opacity: on ? 0.8 : 0.5 }}>{fmtRange(p.s, p.e)}</div>
                </button>
              )
            })}
          </div>

          {/* Start / End toggle */}
          <div className="flex gap-2 bg-charcoal/[0.06] p-1 rounded-xl mb-3">
            {[['start', 'Start', startTime], ['end', 'End', endTime]].map(([k, lbl, val]) => {
              const on = edge === k
              return (
                <button
                  key={k}
                  onClick={() => setEdge(k)}
                  className={`flex-1 cursor-pointer border-none rounded-[9px] py-[7px] ${on ? 'bg-white dark:bg-[#1e1e1e] shadow-[0_1px_3px_rgba(9,18,13,0.1)]' : 'bg-transparent'}`}
                >
                  <div className="font-mono text-[9px] text-charcoal/50 uppercase tracking-[0.06em] font-semibold">{lbl}</div>
                  <div className="font-mono text-[17px] font-semibold mt-0.5 tabular-nums" style={{ color: on ? col : '#76817b' }}>{val}</div>
                </button>
              )
            })}
          </div>

          {/* Wheels */}
          <div className="flex items-center gap-1 mb-[6px]">
            <Wheel values={HOURS}   value={curH} onChange={(h) => setCur(h, curM)} accent={col} />
            <span className="font-mono text-[22px] font-semibold text-charcoal/50 pb-0.5">:</span>
            <Wheel values={MINUTES} value={curM} onChange={(m) => setCur(curH, m)} accent={col} />
          </div>

          {/* Summary */}
          <div className="px-[13px] py-[11px] rounded-[11px] flex items-center gap-2 justify-center flex-wrap mb-[14px]" style={{ background: col + '14' }}>
            <span className="font-mono text-sm font-semibold text-charcoal tabular-nums">{startTime}–{endTime}</span>
            <span className={`text-[12.5px] ${valid ? 'text-charcoal/50' : 'text-danger'}`}>· {valid ? durLabel(startTime, endTime) : 'end must be after start'}</span>
            {valid && cost != null && <span className="font-mono text-[12.5px] text-charcoal/50">· ~£{cost}</span>}
          </div>

          {/* Role chips */}
          {roles.length > 0 && (
            <div className="mb-2">
              <div className="font-mono text-[9.5px] text-charcoal/50 uppercase tracking-[0.07em] font-semibold mb-2">Role</div>
              <div className="flex flex-wrap gap-[6px]">
                {roles.map((r) => {
                  const on = roleLabel === r.name
                  return (
                    <button key={r.id} onClick={() => setRoleLabel(r.name)} className={`cursor-pointer text-xs font-medium px-3 py-[6px] rounded-full border ${on ? 'border-brand bg-brand text-white' : 'border-charcoal/10 bg-white dark:bg-[#1e1e1e] text-charcoal/75'}`}>{r.name}</button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer — always visible regardless of form scroll position */}
        <div className="px-4 border-t border-charcoal/[0.06] bg-surface shrink-0" style={{ paddingTop: 12, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2">
            {existing && (
              <button onClick={del} disabled={deleting} className="w-[52px] h-[50px] rounded-[13px] border border-danger/25 bg-danger/10 text-danger cursor-pointer flex items-center justify-center shrink-0">
                {deleting ? '…' : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>}
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !valid}
              className={`flex-1 h-[50px] rounded-[13px] border-none text-[15px] font-bold ${valid ? 'bg-brand text-white' : 'bg-charcoal/10 text-charcoal/30'} ${(saving || !valid) ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {saving ? '…' : (existing ? 'Save changes' : 'Add to rota')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Swap Sheet ────────────────────────────────────────────────────────────────
function SwapSheet({ swaps, onClose, onResolved }) {
  const [resolving, setResolving] = useState(null)
  const { toast } = useToast()
  const { venueId } = useVenue()
  const pending = swaps.filter(s => s.status === 'pending')

  const approve = async (swap) => {
    setResolving(swap.id)
    const { error: shiftErr } = await supabase.from('shifts').update({ staff_id: swap.target_staff_id }).eq('id', swap.shift_id)
    if (shiftErr) { toast(shiftErr.message, 'error'); setResolving(null); return }
    const { error } = await supabase.from('shift_swaps').update({ status: 'approved', resolved_at: new Date().toISOString() }).eq('id', swap.id)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap approved ✓')
    const staffIds = [swap.requester_id, swap.target_staff_id].filter(Boolean)
    if (staffIds.length) sendPush({ venueId, notificationType: 'shift_swap_decision', title: 'Shift Swap Approved', body: 'Your shift swap has been approved.', url: '/rota', staffIds }).catch(() => {})
    onResolved()
  }

  const decline = async (swap) => {
    setResolving(swap.id)
    const { error } = await supabase.from('shift_swaps').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', swap.id)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap declined')
    onResolved()
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[52] [animation:fadeIn_.2s_ease_both]" style={{ background: 'rgba(9,18,13,0.42)' }} />
      <div className="fixed bottom-0 left-0 right-0 z-[53] bg-surface rounded-t-[22px] max-h-[80%] flex flex-col [animation:sheetUp_.32s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ boxShadow: '0 -12px 40px rgba(9,18,13,0.22)' }}>
        <div className="px-4 pt-[10px]">
          <div className="w-[38px] h-1 rounded-sm bg-charcoal/10 mx-auto mb-[14px]" />
          <div className="text-[18px] font-semibold tracking-[-0.015em] text-charcoal">Swap requests</div>
          <div className="text-[12.5px] text-charcoal/50 mt-0.5 mb-[14px]">{pending.length ? `${pending.length} pending your approval` : 'All caught up'}</div>
        </div>
        <div className="overflow-y-auto flex-1 px-4" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}>
          {pending.length === 0 ? (
            <div className="py-7 text-center">
              <div className="w-11 h-11 rounded-[13px] bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="text-charcoal/50 text-[13px]">No swaps waiting.</div>
            </div>
          ) : pending.map(swap => (
            <div key={swap.id} className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] px-[14px] py-[13px] mb-[10px]">
              <div className="text-[13.5px] font-semibold text-charcoal">{swap.requester_name ?? 'Staff'} → {swap.target_staff_name ?? 'Staff'}</div>
              {swap.shift && (
                <div className="font-mono text-[10px] text-charcoal/50 uppercase tracking-[0.03em] mt-1">
                  {swap.shift.shift_date} · {swap.shift.start_time?.slice(0, 5)}–{swap.shift.end_time?.slice(0, 5)}
                </div>
              )}
              {swap.message && <div className="text-[12.5px] text-charcoal/75 italic mt-2">"{swap.message}"</div>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => decline(swap)} disabled={resolving === swap.id} className="flex-1 h-10 rounded-[10px] border border-charcoal/10 bg-white dark:bg-[#1e1e1e] text-charcoal/75 font-semibold text-[13px] cursor-pointer">Decline</button>
                <button onClick={() => approve(swap)} disabled={resolving === swap.id} className="flex-[2] h-10 rounded-[10px] border-none bg-success text-white font-semibold text-[13px] cursor-pointer">{resolving === swap.id ? '…' : 'Approve'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── AI Sheet ──────────────────────────────────────────────────────────────────
function AISheet({ openShifts, staff, venueId, onClose, onFilled }) {
  const [filling, setFilling] = useState(false)
  const { toast } = useToast()

  const fill = async () => {
    if (!openShifts.length) return
    setFilling(true)
    for (const o of openShifts) {
      if (!o.id) continue
      const oStation = stationFromRole(o.role_label)
      const suggested = staff.find(s => stationFromRole(s.job_role) === oStation) || staff[0]
      if (suggested) {
        await supabase.from('shifts').update({ staff_id: suggested.id }).eq('id', o.id)
      }
    }
    setFilling(false)
    toast(`Auto-fill drafted ${openShifts.length} ${openShifts.length === 1 ? 'shift' : 'shifts'} — review & publish`)
    onFilled?.()
    onClose()
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[52] [animation:fadeIn_.2s_ease_both]" style={{ background: 'rgba(9,18,13,0.42)' }} />
      <div className="fixed bottom-0 left-0 right-0 z-[53] bg-surface rounded-t-[22px] px-4 pb-8 pt-[10px] max-h-[90%] overflow-y-auto [animation:sheetUp_.32s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ boxShadow: '0 -12px 40px rgba(9,18,13,0.22)' }}>
        <div className="w-[38px] h-1 rounded-sm bg-charcoal/10 mx-auto mb-[14px]" />
        <div className="flex items-center gap-[11px]">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(201,79,42,0.10)', color: '#c94f2a' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold tracking-[-0.015em] text-charcoal">Auto-fill gaps</div>
            <div className="text-xs text-charcoal/50 mt-px">Suggests staff for uncovered shifts</div>
          </div>
        </div>
        <div className="mt-[14px] font-mono text-[9.5px] text-charcoal/50 uppercase tracking-[0.07em] font-semibold">{openShifts.length} gaps to cover</div>
        <div className="flex flex-col gap-2 mt-[9px]">
          {openShifts.length === 0 && <div className="py-5 text-center text-charcoal/50 text-[13px]">Week is fully covered.</div>}
          {openShifts.map((o, idx) => {
            const col = STATION_COLOR[stationFromRole(o.role_label)] || '#13362a'
            return (
              <div key={o.id ?? idx} className="flex items-center gap-[11px] px-[13px] py-[11px] bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-xl">
                <span className="w-[9px] h-8 rounded-[4px] shrink-0" style={{ background: col + '26', borderLeft: `3px solid ${col}` }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-charcoal">{o.role_label} · {fmtRange(o.start_time.slice(0,5), o.end_time.slice(0,5))}</div>
                  <div className="font-mono text-[10px] text-charcoal/50 uppercase tracking-[0.03em] mt-px">{format(o._day, 'EEE d MMM')}</div>
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={fill}
          disabled={filling || openShifts.length === 0}
          className="mt-4 w-full h-[50px] rounded-[13px] border-none flex items-center justify-center gap-2 text-[15px] font-bold"
          style={{ cursor: openShifts.length ? 'pointer' : 'default', background: openShifts.length ? '#c94f2a' : '#e4e6e2', color: openShifts.length ? '#fff' : '#b3b9b5' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          {filling ? 'Filling…' : `Draft ${openShifts.length || ''} suggestions`}
        </button>
        <div className="font-mono text-[10px] text-charcoal/30 text-center mt-[9px] tracking-[0.02em]">Added to draft — nothing sent until you publish</div>
      </div>
    </>
  )
}

// ── Grid cell ─────────────────────────────────────────────────────────────────
function GridCell({ shift, isToday: todayCol, onTap }) {
  const baseStyle = {
    width: DAY_COL, minWidth: DAY_COL, height: ROW_H,
  }
  if (!shift) {
    return (
      <button
        className="flex items-center justify-center cursor-pointer font-mono p-[5px_4px] relative border-none shrink-0"
        style={{ ...baseStyle, background: todayCol ? 'rgba(19,54,42,0.04)' : 'transparent' }}
        onClick={onTap}
      >
        <span className="w-[22px] h-[22px] rounded-[7px] border border-dashed border-charcoal/10 flex items-center justify-center text-charcoal/30">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </span>
      </button>
    )
  }
  const station = stationFromRole(shift.role_label)
  const col = station ? STATION_COLOR[station] : '#13362a'
  const dur = Math.round(shiftDurationHours(shift.start_time, shift.end_time))
  const hasSwap = shift._hasSwap
  return (
    <button
      className="flex items-center justify-center cursor-pointer font-mono p-[5px_4px] relative border-none shrink-0"
      style={{ ...baseStyle, background: todayCol ? 'rgba(19,54,42,0.04)' : 'transparent' }}
      onClick={onTap}
    >
      <span className="w-full h-full rounded-[10px] flex flex-col items-center justify-center gap-0.5 relative" style={{ background: col + '1a' }}>
        <span className="font-mono text-xs font-bold tabular-nums leading-none tracking-[-0.02em]" style={{ color: col }}>{fmtRange(shift.start_time.slice(0,5), shift.end_time.slice(0,5))}</span>
        <span className="font-mono text-[8.5px] font-medium" style={{ color: col, opacity: 0.7 }}>{dur}h</span>
        {hasSwap && <span className="absolute top-[3px] right-1 w-[7px] h-[7px] rounded-[4px] bg-warning border-[1.5px] border-white" />}
      </span>
    </button>
  )
}

// ── Station legend ────────────────────────────────────────────────────────────
function StationLegend() {
  return (
    <div className="flex items-center gap-3 px-1 py-0.5 flex-wrap">
      {STATION_ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-[5px] font-mono text-[9.5px] text-charcoal/50 uppercase tracking-[0.04em]">
          <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: STATION_COLOR[s] + '22', borderLeft: `2.5px solid ${STATION_COLOR[s]}` }} />{s}
        </span>
      ))}
    </div>
  )
}

// ── Gaps strip ────────────────────────────────────────────────────────────────
function GapsStrip({ openShifts, days, onFill }) {
  if (!openShifts.length) return null
  return (
    <div>
      <div className="flex items-center gap-[7px] px-0.5 pb-[9px]">
        <span className="w-[6px] h-[6px] rounded-[3px] bg-danger shrink-0" />
        <span className="font-mono text-[10.5px] text-danger tracking-[0.07em] uppercase font-semibold">{openShifts.length} {openShifts.length === 1 ? 'shift needs' : 'shifts need'} filling</span>
      </div>
      <div className="flex flex-col gap-2">
        {openShifts.map((o, idx) => {
          const station = stationFromRole(o.role_label)
          const col = station ? STATION_COLOR[station] : '#13362a'
          return (
            <div key={o.id ?? idx} className="flex items-center gap-[13px] px-[13px] py-[11px] bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[13px]">
              <span className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0" style={{ background: col + '1c', color: col }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-charcoal tracking-[-0.01em]">{o.role_label} · {fmtRange(o.start_time.slice(0,5), o.end_time.slice(0,5))}</div>
                <div className="text-[11.5px] text-charcoal/50 mt-0.5">{format(o._day, 'EEE d MMM')} · unassigned</div>
              </div>
              <button onClick={() => onFill(o)} className="text-[12.5px] font-semibold text-white bg-brand px-[15px] py-2 rounded-[9px] border-none cursor-pointer">Fill</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── RotaMobileGrid ────────────────────────────────────────────────────────────
export default function RotaMobileGrid() {
  const { venueId, venueName } = useVenue()
  const { session } = useSession()
  const { signOutVenue } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [weekOffset, setWeekOffset] = useState(0)
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const days = getWeekDays(weekStart)
  const weekLabel = `${format(days[0], 'd MMM')}–${format(days[6], 'd MMM')}`.toUpperCase()

  const weekTitle = weekOffset === 0
    ? 'This week'
    : weekOffset < 0 ? `${-weekOffset}w ago`
    : `In ${weekOffset}w`

  const [shiftSheet, setShiftSheet] = useState(null)
  const [showSwaps, setShowSwaps]   = useState(false)
  const [showAI, setShowAI]         = useState(false)
  const [showCost, setShowCost]     = useState(false)
  const [pendingChanges, setPendingChanges] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [dbPublished, setDbPublished] = useState(false)

  const { shifts, loading, reload } = useShifts(weekStart, 1)
  const { staff, loading: staffLoading } = useStaffList()
  const { swaps, pendingCount, reload: reloadSwaps } = useShiftSwaps()
  const { roles } = useVenueRoles()

  useEffect(() => {
    if (!venueId) return
    setDbPublished(false)
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    supabase
      .from('app_settings')
      .select('value')
      .eq('venue_id', venueId)
      .eq('key', `rota_published_${weekStartStr}`)
      .maybeSingle()
      .then(({ data }) => setDbPublished(!!data?.value))
  }, [venueId, weekStart])

  const prevWeek = () => { const w = subWeeks(weekStart, 1); setWeekStart(w); setWeekOffset(o => o - 1); setPendingChanges(0) }
  const nextWeek = () => { const w = addWeeks(weekStart, 1); setWeekStart(w); setWeekOffset(o => o + 1); setPendingChanges(0) }

  const shiftMap = {}
  const swapShiftIds = new Set(swaps.filter(s => s.status === 'pending').map(s => s.shift_id))
  for (const s of shifts) {
    const key = `${s.staff_id}|${s.shift_date}`
    shiftMap[key] = { ...s, _hasSwap: swapShiftIds.has(s.id) }
  }

  const openShifts = shifts
    .filter(s => !s.staff_id)
    .map(s => ({ ...s, _day: days.find(d => format(d, 'yyyy-MM-dd') === s.shift_date) ?? days[0] }))

  const dayTotals = days.map(day => {
    const ds = format(day, 'yyyy-MM-dd')
    const dayShifts = shifts.filter(s => s.shift_date === ds && s.staff_id)
    return {
      hours: Math.round(dayShifts.reduce((sum, s) => sum + shiftDurationHours(s.start_time, s.end_time), 0)),
      cost:  Math.round(dayShifts.reduce((sum, s) => sum + (s.staff ? paidShiftHours(s.start_time, s.end_time) * (s.staff.hourly_rate ?? 0) : 0), 0)),
      count: dayShifts.length,
    }
  })
  const weekHours = dayTotals.reduce((a, t) => a + t.hours, 0)
  const weekCost  = dayTotals.reduce((a, t) => a + t.cost, 0)

  const managerInitials = (session?.staffName ?? 'MG').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const isDraft      = pendingChanges > 0
  const isPublished  = dbPublished && pendingChanges === 0

  const publish = async () => {
    setPublishing(true)
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const { error } = await supabase.from('app_settings').upsert({ venue_id: venueId, key: `rota_published_${weekStartStr}`, value: new Date().toISOString() }, { onConflict: 'venue_id,key' })
    if (error) { toast(error.message, 'error'); setPublishing(false); return }
    const staffIds = [...new Set(shifts.map(s => s.staff_id).filter(Boolean))]
    if (staffIds.length) {
      sendPush({ venueId, notificationType: 'rota_published', title: 'Rota Published', body: `Your rota for the week of ${weekStartStr} is now available.`, url: '/rota', staffIds }).catch(() => {})
    }
    setPublishing(false)
    setPendingChanges(0)
    setDbPublished(true)
    toast('Rota published — everyone notified ✓')
  }

  const handleSaved   = () => { setPendingChanges(c => c + 1); reload() }
  const handleDeleted = () => { setPendingChanges(c => c + 1); reload() }
  const isLoading = loading || staffLoading

  return (
    <>
      <style>{`
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn  { from { opacity: 0; }                 to { opacity: 1; } }
      `}</style>

      <div className="fixed inset-0 z-[51] flex flex-col bg-surface text-charcoal overflow-hidden">

        {/* ── Header: matches AppShell mobile header ── */}
        <header className="bg-brand text-white shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="px-4 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-bold text-[15px] tracking-[0.08em] uppercase text-white overflow-hidden text-ellipsis whitespace-nowrap max-w-[160px]">{venueName || 'Pelikn'}</span>
              <NotificationBell />
            </div>
            <button onClick={signOutVenue} className="text-[11px] font-bold tracking-[0.06em] uppercase text-white bg-transparent border border-white/30 rounded-lg px-3 py-[6px] cursor-pointer whitespace-nowrap shrink-0">Sign Out</button>
          </div>
        </header>

        {/* ── Cream sub-header: eyebrow + status pill + week nav ── */}
        <div className="px-[14px] pt-3 pb-2 bg-surface shrink-0">
          <div className="flex justify-between items-center px-1 pb-2">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 text-charcoal/50 font-mono text-[11px] tracking-[0.06em] uppercase font-semibold">
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
              Team
            </button>
            <span
              className={`inline-flex items-center gap-[5px] font-mono text-[9.5px] font-bold px-2 py-[3px] rounded-full tracking-[0.05em] uppercase border ${isDraft ? 'text-warning bg-warning/10 border-warning' : isPublished ? 'text-success bg-success/10 border-success' : 'text-charcoal/50 bg-charcoal/[0.06] border-charcoal/10'}`}
            >
              <span className="w-[5px] h-[5px] rounded-[3px] bg-current" />
              {isDraft ? `Draft · ${pendingChanges} change${pendingChanges !== 1 ? 's' : ''}` : isPublished ? 'Published' : 'Not published'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="w-8 flex items-center justify-center shrink-0 bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[9px] text-charcoal/50 cursor-pointer" style={{ height: 60 }}>
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1L1 7l6 6"/></svg>
            </button>
            <div className="flex-1 bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[9px] flex flex-col items-center justify-center gap-0.5" style={{ height: 60 }}>
              <span className="text-[15px] font-semibold tracking-[-0.015em] text-charcoal">{weekTitle}</span>
              <span className="font-mono text-[10px] text-charcoal/50 tracking-[0.06em] uppercase">{weekLabel}</span>
            </div>
            <button onClick={nextWeek} className="w-8 flex items-center justify-center shrink-0 bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[9px] text-charcoal/50 cursor-pointer" style={{ height: 60 }}>
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1l6 6-6 6"/></svg>
            </button>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="flex items-center justify-between gap-2 px-[14px] py-[10px] bg-surface border-b border-charcoal/10 shrink-0">
          <div className="flex items-baseline gap-[6px] shrink-0">
            <span className="font-mono text-[9.5px] text-charcoal/50 uppercase tracking-[0.07em] font-semibold">Week</span>
            <span className="font-mono text-[15px] font-semibold text-charcoal tabular-nums">{showCost ? `£${weekCost}` : `${weekHours}h`}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Hours / £ toggle */}
            <div className="flex bg-charcoal/[0.06] rounded-[9px] p-[3px]">
              {[['Hours', false], ['£', true]].map(([lbl, val]) => {
                const on = showCost === val
                return (
                  <button key={lbl} onClick={() => setShowCost(val)} className={`cursor-pointer border-none rounded-[7px] px-[11px] py-[5px] text-xs font-semibold ${on ? 'bg-white dark:bg-[#1e1e1e] text-charcoal shadow-[0_1px_2px_rgba(9,18,13,0.1)]' : 'bg-transparent text-charcoal/50'}`}>{lbl}</button>
                )
              })}
            </div>
            {/* Auto-fill */}
            <button onClick={() => setShowAI(true)} title="Auto-fill gaps" className="flex items-center gap-[5px] text-[12.5px] font-semibold border-none rounded-[9px] px-[11px] py-[7px] cursor-pointer" style={{ color: '#c94f2a', background: 'rgba(201,79,42,0.10)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
              Auto-fill
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[200px] text-charcoal/50 text-sm">Loading…</div>
          ) : (
            <div className="px-[13px] pt-[13px] flex flex-col gap-[13px]">

              {/* Swap banner */}
              {pendingCount > 0 && (
                <button onClick={() => setShowSwaps(true)} className="w-full text-left cursor-pointer flex items-center gap-[11px] px-[14px] py-3 border-none rounded-[13px]" style={{ background: '#fbeedc' }}>
                  <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: 'rgba(168,93,18,0.16)', color: '#a85d12' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13"/></svg>
                  </span>
                  <span className="flex-1 text-[13.5px] font-semibold text-warning">{pendingCount} swap {pendingCount === 1 ? 'request' : 'requests'} pending</span>
                  <span className="font-mono text-[10px] font-bold text-warning uppercase tracking-[0.05em] flex items-center gap-1">
                    Review
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4"/></svg>
                  </span>
                </button>
              )}

              {/* Week grid — wrapped in card */}
              <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <div style={{ minWidth: NAME_W + DAY_COL * 7 }}>

                    {/* Header row */}
                    <div className="flex border-b border-charcoal/10">
                      <div className="shrink-0 sticky left-0 z-[3] bg-white dark:bg-[#1e1e1e]" style={{ width: NAME_W, minWidth: NAME_W }} />
                      {days.map((day, i) => {
                        const today = isToday(day)
                        return (
                          <div key={i} className="shrink-0 text-center pt-[11px] pb-[9px]" style={{ width: DAY_COL, minWidth: DAY_COL, background: today ? 'rgba(19,54,42,0.04)' : 'transparent' }}>
                            <div className="font-mono text-[9px] tracking-[0.06em] uppercase text-charcoal/50 font-semibold">{format(day, 'EEE')}</div>
                            <div className="mt-1 w-[26px] h-[26px] rounded-full flex items-center justify-center mx-auto" style={{ background: today ? '#13362a' : 'transparent' }}>
                              <span className="font-mono text-[13px] font-semibold" style={{ color: today ? '#fff' : '#0d1a14' }}>{format(day, 'd')}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Staff rows */}
                    {staff.map((member, ri) => {
                      const station = stationFromRole(member.job_role)
                      return (
                        <div key={member.id} className="flex" style={{ borderBottom: ri === staff.length - 1 ? 'none' : '1px solid #eef0ec' }}>
                          <div
                            className="shrink-0 sticky left-0 z-[2] bg-white dark:bg-[#1e1e1e] border-r border-charcoal/[0.06] flex items-center gap-2 px-[9px]"
                            style={{ width: NAME_W, minWidth: NAME_W }}
                          >
                            <span className="relative shrink-0">
                              <Avatar name={member.name} station={station} size={28} />
                              {station && <span className="absolute -bottom-px -right-px w-2 h-2 rounded-[4px] border-[1.5px] border-white" style={{ background: STATION_COLOR[station] }} />}
                            </span>
                            <span className="text-[12.5px] font-semibold text-charcoal tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis">
                              {member.name?.split(' ')[0] ?? '—'}
                            </span>
                          </div>
                          {days.map((day, di) => {
                            const dateStr = format(day, 'yyyy-MM-dd')
                            const shift = shiftMap[`${member.id}|${dateStr}`] ?? null
                            return (
                              <GridCell key={di} shift={shift} isToday={isToday(day)} onTap={() => setShiftSheet({ shift, staffMember: member, day })} />
                            )
                          })}
                        </div>
                      )
                    })}

                    {/* Totals row */}
                    <div className="flex bg-surface border-t border-charcoal/10">
                      <div
                        className="shrink-0 sticky left-0 z-[2] bg-surface border-r border-charcoal/[0.06] flex items-center px-[9px]"
                        style={{ width: NAME_W, minWidth: NAME_W }}
                      >
                        <span className="font-mono text-[9px] font-semibold text-charcoal/50 uppercase tracking-[0.06em]">{showCost ? 'Cost' : 'Hours'}</span>
                      </div>
                      {dayTotals.map((t, i) => (
                        <div key={i} className="shrink-0 text-center py-[11px]" style={{ width: DAY_COL, minWidth: DAY_COL, background: isToday(days[i]) ? 'rgba(19,54,42,0.04)' : 'transparent' }}>
                          <div className="font-mono text-xs font-semibold text-charcoal tabular-nums">{showCost ? `£${t.cost}` : `${t.hours}h`}</div>
                          <div className="font-mono text-[8px] text-charcoal/30 mt-0.5 uppercase tracking-[0.04em]">{t.count} on</div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>

              {/* Gaps strip */}
              <GapsStrip openShifts={openShifts} days={days} onFill={(o) => setShiftSheet({ shift: o, staffMember: null, day: o._day })} />

              {/* Station legend */}
              <StationLegend />

            </div>
          )}
          <div style={{ height: pendingChanges > 0 ? 150 : 96 }} />
        </div>

        {/* ── Publish bar ── */}
        {pendingChanges > 0 && (
          <div className="absolute bottom-4 left-3 right-3 z-[30] bg-charcoal text-white rounded-[15px] px-[14px] py-3 flex items-center gap-3" style={{ boxShadow: '0 10px 30px rgba(9,18,13,0.34)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold">{pendingChanges} unpublished {pendingChanges === 1 ? 'change' : 'changes'}</div>
              <div className="font-mono text-[9.5px] text-white/60 uppercase tracking-[0.04em] mt-0.5">Staff won't see them yet</div>
            </div>
            <button onClick={() => { setPendingChanges(0); reload() }} disabled={publishing} className="h-10 px-[14px] rounded-[11px] border border-white/25 cursor-pointer bg-transparent text-white/75 text-[13.5px] font-semibold">
              Cancel
            </button>
            <button onClick={publish} disabled={publishing} className="h-10 px-[18px] rounded-[11px] border-none cursor-pointer bg-white text-charcoal text-[13.5px] font-bold flex items-center gap-[7px]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        )}

        {/* ── Sheets ── */}
        {shiftSheet && (
          <ShiftSheet
            shift={shiftSheet.shift}
            staffMember={shiftSheet.staffMember}
            day={shiftSheet.day}
            venueId={venueId}
            roles={roles}
            onClose={() => setShiftSheet(null)}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}
        {showSwaps && (
          <SwapSheet
            swaps={swaps}
            onClose={() => setShowSwaps(false)}
            onResolved={() => { reloadSwaps(); reload() }}
          />
        )}
        {showAI && (
          <AISheet
            openShifts={openShifts}
            staff={staff}
            days={days}
            venueId={venueId}
            onClose={() => setShowAI(false)}
            onFilled={() => { reload(); setPendingChanges(c => c + openShifts.length) }}
          />
        )}
      </div>
    </>
  )
}
