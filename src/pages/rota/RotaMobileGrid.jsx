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

// ── Design tokens ─────────────────────────────────────────────────────────────
const MC = {
  brand: '#13362a', brandSoft: '#e2ece7', brandTint: '#eef4f0',
  ink: '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  bg: '#f3f3ef', paper: '#ffffff',
  line: '#e4e6e2', line2: '#eef0ec',
  good: '#1a7a4c', goodBg: '#e3f0e7',
  warn: '#a85d12', warnBg: '#fbeedc',
  bad:  '#b3331c', badBg:  '#fbeae6',
  accent: '#c94f2a', accentSoft: 'rgba(201,79,42,0.10)',
  info: '#2c4577', infoBg: '#e7edf6',
}
const MONO = "'Geist Mono', ui-monospace, monospace"
const SANS = "'Geist', -apple-system, system-ui, sans-serif"

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
  return null
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

  return (
    <div style={{ position: 'relative', height: VIS * IH, flex: 1 }}>
      <div ref={setNode} onScroll={onScroll} style={{ height: VIS * IH, overflowY: 'scroll', scrollSnapType: 'y mandatory', padding: `${((VIS - 1) / 2) * IH}px 0`, scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        {values.map((v, i) => {
          const active = v === value
          return (
            <div key={v} onClick={() => { ref.current?.scrollTo({ top: i * IH, behavior: 'smooth' }); onChange(v) }} style={{ height: IH, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center', cursor: 'pointer', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: active ? 25 : 19, fontWeight: active ? 600 : 500, color: active ? (accent || MC.ink) : MC.ink4, letterSpacing: '-0.02em', transition: 'font-size .1s, color .1s' }}>{v}</div>
          )
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: ((VIS - 1) / 2) * IH, height: IH, pointerEvents: 'none', borderTop: `1px solid ${MC.line}`, borderBottom: `1px solid ${MC.line}`, background: 'rgba(19,54,42,0.03)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ((VIS - 1) / 2) * IH, pointerEvents: 'none', background: `linear-gradient(${MC.bg}, ${MC.bg}00)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: ((VIS - 1) / 2) * IH, pointerEvents: 'none', background: `linear-gradient(${MC.bg}00, ${MC.bg})` }} />
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, station, size = 28 }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('')
  const av = STATION_AVATAR[station] || { bg: MC.brandTint, fg: MC.brand }
  return (
    <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: av.bg, color: av.fg, flexShrink: 0, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: size * 0.32, fontWeight: 600 }}>{initials}</span>
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
  const col       = station ? STATION_COLOR[station] : MC.brand
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,18,13,0.42)', zIndex: 52, animation: 'fadeIn .2s ease both' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 53, background: MC.bg, borderRadius: '22px 22px 0 0', maxHeight: '90%', boxShadow: '0 -12px 40px rgba(9,18,13,0.22)', animation: 'sheetUp .32s cubic-bezier(0.16,1,0.3,1) both', display: 'flex', flexDirection: 'column' }}>

        {/* Scrollable form body */}
        <div style={{ overflowY: 'auto', padding: '10px 16px 4px', flex: 1 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: MC.line, margin: '0 auto 14px' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Avatar name={staffMember?.name} station={station} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', color: MC.ink }}>{staffMember?.name ?? 'Unassigned'}</div>
              <div style={{ fontSize: 12, color: MC.ink3, marginTop: 1 }}>{roleLabel || staffMember?.job_role || ''} · {format(day, 'EEE d MMM')}</div>
            </div>
            <button onClick={onClose} style={{ background: MC.line2, border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, color: MC.ink3 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
            {PRESETS.map((p) => {
              const on = startTime === p.s && endTime === p.e
              return (
                <button key={p.label} onClick={() => applyPreset(p)} style={{ flex: 1, cursor: 'pointer', fontFamily: SANS, border: `1px solid ${on ? col : MC.line}`, borderRadius: 10, padding: '7px 2px', background: on ? col : MC.paper, color: on ? '#fff' : MC.ink2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 8.5, marginTop: 1, opacity: on ? 0.8 : 0.5 }}>{fmtRange(p.s, p.e)}</div>
                </button>
              )
            })}
          </div>

          {/* Start / End toggle */}
          <div style={{ display: 'flex', gap: 8, background: MC.line2, padding: 4, borderRadius: 12, marginBottom: 12 }}>
            {[['start', 'Start', startTime], ['end', 'End', endTime]].map(([k, lbl, val]) => {
              const on = edge === k
              return (
                <button key={k} onClick={() => setEdge(k)} style={{ flex: 1, cursor: 'pointer', fontFamily: SANS, border: 'none', borderRadius: 9, padding: '7px 0', background: on ? MC.paper : 'transparent', boxShadow: on ? '0 1px 3px rgba(9,18,13,0.1)' : 'none' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{lbl}</div>
                  <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: on ? col : MC.ink3, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                </button>
              )
            })}
          </div>

          {/* Wheels */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <Wheel values={HOURS}   value={curH} onChange={(h) => setCur(h, curM)} accent={col} />
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: MC.ink3, paddingBottom: 2 }}>:</span>
            <Wheel values={MINUTES} value={curM} onChange={(m) => setCur(curH, m)} accent={col} />
          </div>

          {/* Summary */}
          <div style={{ padding: '11px 13px', borderRadius: 11, background: col + '14', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: MC.ink, fontVariantNumeric: 'tabular-nums' }}>{startTime}–{endTime}</span>
            <span style={{ fontSize: 12.5, color: valid ? MC.ink3 : MC.bad }}>· {valid ? durLabel(startTime, endTime) : 'end must be after start'}</span>
            {valid && cost != null && <span style={{ fontFamily: MONO, fontSize: 12.5, color: MC.ink3 }}>· ~£{cost}</span>}
          </div>

          {/* Role chips */}
          {roles.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 8 }}>Role</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {roles.map((r) => {
                  const on = roleLabel === r.name
                  return (
                    <button key={r.id} onClick={() => setRoleLabel(r.name)} style={{ cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? MC.brand : MC.line}`, background: on ? MC.brand : MC.paper, color: on ? '#fff' : MC.ink2 }}>{r.name}</button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer — always visible regardless of form scroll position */}
        <div style={{ padding: '12px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', borderTop: `1px solid ${MC.line2}`, background: MC.bg, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {existing && (
              <button onClick={del} disabled={deleting} style={{ width: 52, height: 50, borderRadius: 13, border: `1px solid ${MC.bad}40`, background: MC.badBg, color: MC.bad, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {deleting ? '…' : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>}
              </button>
            )}
            <button onClick={save} disabled={saving || !valid} style={{ flex: 1, height: 50, borderRadius: 13, border: 'none', cursor: (saving || !valid) ? 'default' : 'pointer', background: valid ? MC.brand : MC.line, color: valid ? '#fff' : MC.ink4, fontFamily: SANS, fontSize: 15, fontWeight: 700 }}>
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,18,13,0.42)', zIndex: 52, animation: 'fadeIn .2s ease both' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 53, background: MC.bg, borderRadius: '22px 22px 0 0', maxHeight: '80%', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 40px rgba(9,18,13,0.22)', animation: 'sheetUp .32s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div style={{ padding: '10px 16px 0' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: MC.line, margin: '0 auto 14px' }} />
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', color: MC.ink }}>Swap requests</div>
          <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 2, marginBottom: 14 }}>{pending.length ? `${pending.length} pending your approval` : 'All caught up'}</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px', paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}>
          {pending.length === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: MC.goodBg, color: MC.good, display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ color: MC.ink3, fontSize: 13 }}>No swaps waiting.</div>
            </div>
          ) : pending.map(swap => (
            <div key={swap.id} style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, padding: '13px 14px', marginBottom: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: MC.ink }}>{swap.requester_name ?? 'Staff'} → {swap.target_staff_name ?? 'Staff'}</div>
              {swap.shift && (
                <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>
                  {swap.shift.shift_date} · {swap.shift.start_time?.slice(0, 5)}–{swap.shift.end_time?.slice(0, 5)}
                </div>
              )}
              {swap.message && <div style={{ fontSize: 12.5, color: MC.ink2, fontStyle: 'italic', marginTop: 8 }}>"{swap.message}"</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => decline(swap)} disabled={resolving === swap.id} style={{ flex: 1, height: 40, borderRadius: 10, border: `1px solid ${MC.line}`, background: MC.paper, color: MC.ink2, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>Decline</button>
                <button onClick={() => approve(swap)} disabled={resolving === swap.id} style={{ flex: 2, height: 40, borderRadius: 10, border: 'none', background: MC.good, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>{resolving === swap.id ? '…' : 'Approve'}</button>
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
      // find a free same-station staff member (simplified)
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,18,13,0.42)', zIndex: 52, animation: 'fadeIn .2s ease both' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 53, background: MC.bg, borderRadius: '22px 22px 0 0', padding: '10px 16px 32px', maxHeight: '90%', overflowY: 'auto', boxShadow: '0 -12px 40px rgba(9,18,13,0.22)', animation: 'sheetUp .32s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: MC.line, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: MC.accentSoft, color: MC.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', color: MC.ink }}>Auto-fill gaps</div>
            <div style={{ fontSize: 12, color: MC.ink3, marginTop: 1 }}>Suggests staff for uncovered shifts</div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 9.5, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{openShifts.length} gaps to cover</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
          {openShifts.length === 0 && <div style={{ padding: '20px 0', textAlign: 'center', color: MC.ink3, fontSize: 13 }}>Week is fully covered.</div>}
          {openShifts.map((o, idx) => {
            const col = STATION_COLOR[stationFromRole(o.role_label)] || MC.brand
            return (
              <div key={o.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 12 }}>
                <span style={{ width: 9, height: 32, borderRadius: 4, background: col + '26', borderLeft: `3px solid ${col}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: MC.ink }}>{o.role_label} · {fmtRange(o.start_time.slice(0,5), o.end_time.slice(0,5))}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 1 }}>{format(o._day, 'EEE d MMM')}</div>
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={fill} disabled={filling || openShifts.length === 0} style={{ marginTop: 16, width: '100%', height: 50, borderRadius: 13, border: 'none', cursor: openShifts.length ? 'pointer' : 'default', background: openShifts.length ? MC.accent : MC.line, color: openShifts.length ? '#fff' : MC.ink4, fontFamily: SANS, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          {filling ? 'Filling…' : `Draft ${openShifts.length || ''} suggestions`}
        </button>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, textAlign: 'center', marginTop: 9, letterSpacing: '0.02em' }}>Added to draft — nothing sent until you publish</div>
      </div>
    </>
  )
}

// ── Grid cell ─────────────────────────────────────────────────────────────────
function GridCell({ shift, isToday: todayCol, onTap }) {
  const base = {
    width: DAY_COL, minWidth: DAY_COL, height: ROW_H, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: MONO, padding: '5px 4px', position: 'relative',
    background: todayCol ? 'rgba(19,54,42,0.04)' : 'transparent', border: 'none',
  }
  if (!shift) {
    return (
      <button style={base} onClick={onTap}>
        <span style={{ width: 22, height: 22, borderRadius: 7, border: `1px dashed ${MC.line}`, display: 'grid', placeItems: 'center', color: MC.ink4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </span>
      </button>
    )
  }
  const station = stationFromRole(shift.role_label)
  const col = station ? STATION_COLOR[station] : MC.brand
  const dur = Math.round(shiftDurationHours(shift.start_time, shift.end_time))
  const hasSwap = shift._hasSwap
  return (
    <button style={base} onClick={onTap}>
      <span style={{ width: '100%', height: '100%', borderRadius: 10, background: col + '1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: col, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtRange(shift.start_time.slice(0,5), shift.end_time.slice(0,5))}</span>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: col, opacity: 0.7, fontWeight: 500 }}>{dur}h</span>
        {hasSwap && <span style={{ position: 'absolute', top: 3, right: 4, width: 7, height: 7, borderRadius: 4, background: MC.warn, border: '1.5px solid #fff' }} />}
      </span>
    </button>
  )
}

// ── Station legend ────────────────────────────────────────────────────────────
function StationLegend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 4px', flexWrap: 'wrap' }}>
      {STATION_ORDER.map((s) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9.5, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: STATION_COLOR[s] + '22', borderLeft: `2.5px solid ${STATION_COLOR[s]}` }} />{s}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 2px 9px' }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: MC.bad, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: MC.bad, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>{openShifts.length} {openShifts.length === 1 ? 'shift needs' : 'shifts need'} filling</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {openShifts.map((o, idx) => {
          const station = stationFromRole(o.role_label)
          const col = station ? STATION_COLOR[station] : MC.brand
          return (
            <div key={o.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 13px', background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 13 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: col + '1c', color: col, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: MC.ink, letterSpacing: '-0.01em' }}>{o.role_label} · {fmtRange(o.start_time.slice(0,5), o.end_time.slice(0,5))}</div>
                <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2 }}>{format(o._day, 'EEE d MMM')} · unassigned</div>
              </div>
              <button onClick={() => onFill(o)} style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: '#fff', background: MC.brand, padding: '8px 15px', borderRadius: 9, border: 'none', cursor: 'pointer' }}>Fill</button>
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

  const { shifts, loading, reload } = useShifts(weekStart, 1)
  const { staff, loading: staffLoading } = useStaffList()
  const { swaps, pendingCount, reload: reloadSwaps } = useShiftSwaps()
  const { roles } = useVenueRoles()

  const prevWeek = () => { const w = subWeeks(weekStart, 1); setWeekStart(w); setWeekOffset(o => o - 1); setPendingChanges(0) }
  const nextWeek = () => { const w = addWeeks(weekStart, 1); setWeekStart(w); setWeekOffset(o => o + 1); setPendingChanges(0) }

  // Build shift lookup
  const shiftMap = {}
  const swapShiftIds = new Set(swaps.filter(s => s.status === 'pending').map(s => s.shift_id))
  for (const s of shifts) {
    const key = `${s.staff_id}|${s.shift_date}`
    shiftMap[key] = { ...s, _hasSwap: swapShiftIds.has(s.id) }
  }

  // Open (unassigned) shifts for this week
  const openShifts = shifts
    .filter(s => !s.staff_id)
    .map(s => ({ ...s, _day: days.find(d => format(d, 'yyyy-MM-dd') === s.shift_date) ?? days[0] }))

  // Per-day totals
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
  const isDraft = pendingChanges > 0

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

      <div style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', flexDirection: 'column', background: MC.bg, fontFamily: SANS, color: MC.ink, overflow: 'hidden' }}>

        {/* ── Header: matches AppShell mobile header ── */}
        <header style={{ background: MC.brand, color: '#fff', flexShrink: 0, paddingTop: 'env(safe-area-inset-top)' }}>
          <div style={{ padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{venueName || 'Pelikn'}</span>
              <NotificationBell />
            </div>
            <button onClick={signOutVenue} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap', flexShrink: 0 }}>Sign Out</button>
          </div>
        </header>

        {/* ── Cream sub-header: eyebrow + status pill + week nav ── */}
        <div style={{ padding: '12px 14px 8px', background: MC.bg, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 8px' }}>
            <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: MC.ink3, fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
              Team
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: isDraft ? MC.warn : MC.good, background: isDraft ? MC.warnBg : MC.goodBg, padding: '3px 8px', borderRadius: 999, letterSpacing: '0.05em', textTransform: 'uppercase', border: `1px solid ${isDraft ? MC.warn : MC.good}25` }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
              {isDraft ? `Draft · ${pendingChanges} unpublished` : 'Published'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={prevWeek} style={{ width: 32, height: 60, borderRadius: 9, background: MC.paper, border: `1px solid ${MC.line}`, display: 'grid', placeItems: 'center', color: MC.ink3, cursor: 'pointer', flexShrink: 0 }}>
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1L1 7l6 6"/></svg>
            </button>
            <div style={{ flex: 1, height: 60, borderRadius: 9, background: MC.paper, border: `1px solid ${MC.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: MC.ink }}>{weekTitle}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{weekLabel}</span>
            </div>
            <button onClick={nextWeek} style={{ width: 32, height: 60, borderRadius: 9, background: MC.paper, border: `1px solid ${MC.line}`, display: 'grid', placeItems: 'center', color: MC.ink3, cursor: 'pointer', flexShrink: 0 }}>
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1l6 6-6 6"/></svg>
            </button>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', background: MC.bg, borderBottom: `1px solid ${MC.line}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 9.5, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Week</span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: MC.ink, fontVariantNumeric: 'tabular-nums' }}>{showCost ? `£${weekCost}` : `${weekHours}h`}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Hours / £ toggle */}
            <div style={{ display: 'flex', background: MC.line2, borderRadius: 9, padding: 3 }}>
              {[['Hours', false], ['£', true]].map(([lbl, val]) => {
                const on = showCost === val
                return (
                  <button key={lbl} onClick={() => setShowCost(val)} style={{ cursor: 'pointer', fontFamily: SANS, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, background: on ? MC.paper : 'transparent', color: on ? MC.ink : MC.ink3, boxShadow: on ? '0 1px 2px rgba(9,18,13,0.1)' : 'none' }}>{lbl}</button>
                )
              })}
            </div>
            {/* Auto-fill */}
            <button onClick={() => setShowAI(true)} title="Auto-fill gaps" style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: MC.accent, background: MC.accentSoft, border: 'none', borderRadius: 9, padding: '7px 11px', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
              Auto-fill
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: MC.ink3, fontSize: 14 }}>Loading…</div>
          ) : (
            <div style={{ padding: '13px 13px 0', display: 'flex', flexDirection: 'column', gap: 13 }}>

              {/* Swap banner */}
              {pendingCount > 0 && (
                <button onClick={() => setShowSwaps(true)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: MC.warnBg, border: 'none', borderRadius: 13 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(168,93,18,0.16)', color: MC.warn, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13"/></svg>
                  </span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: MC.warn }}>{pendingCount} swap {pendingCount === 1 ? 'request' : 'requests'} pending</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: MC.warn, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Review
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4"/></svg>
                  </span>
                </button>
              )}

              {/* Week grid — wrapped in card */}
              <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <div style={{ minWidth: NAME_W + DAY_COL * 7 }}>

                    {/* Header row */}
                    <div style={{ display: 'flex', borderBottom: `1px solid ${MC.line}` }}>
                      <div style={{ width: NAME_W, minWidth: NAME_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: MC.paper }} />
                      {days.map((day, i) => {
                        const today = isToday(day)
                        return (
                          <div key={i} style={{ width: DAY_COL, minWidth: DAY_COL, flexShrink: 0, textAlign: 'center', padding: '11px 0 9px', background: today ? 'rgba(19,54,42,0.04)' : 'transparent' }}>
                            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: MC.ink3, fontWeight: 600 }}>{format(day, 'EEE')}</div>
                            <div style={{ margin: '4px auto 0', width: 26, height: 26, borderRadius: 13, display: 'grid', placeItems: 'center', background: today ? MC.brand : 'transparent' }}>
                              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: today ? '#fff' : MC.ink }}>{format(day, 'd')}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Staff rows */}
                    {staff.map((member, ri) => {
                      const station = stationFromRole(member.job_role)
                      return (
                        <div key={member.id} style={{ display: 'flex', borderBottom: ri === staff.length - 1 ? 'none' : `1px solid ${MC.line2}` }}>
                          <div style={{ width: NAME_W, minWidth: NAME_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2, background: MC.paper, borderRight: `1px solid ${MC.line2}`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 9px' }}>
                            <span style={{ position: 'relative', flexShrink: 0 }}>
                              <Avatar name={member.name} station={station} size={28} />
                              {station && <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: 4, background: STATION_COLOR[station], border: '1.5px solid #fff' }} />}
                            </span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: MC.ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <div style={{ display: 'flex', background: MC.bg, borderTop: `1px solid ${MC.line}` }}>
                      <div style={{ width: NAME_W, minWidth: NAME_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2, background: MC.bg, borderRight: `1px solid ${MC.line2}`, display: 'flex', alignItems: 'center', padding: '0 9px' }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: MC.ink3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{showCost ? 'Cost' : 'Hours'}</span>
                      </div>
                      {dayTotals.map((t, i) => (
                        <div key={i} style={{ width: DAY_COL, minWidth: DAY_COL, flexShrink: 0, textAlign: 'center', padding: '11px 0', background: isToday(days[i]) ? 'rgba(19,54,42,0.04)' : 'transparent' }}>
                          <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: MC.ink, fontVariantNumeric: 'tabular-nums' }}>{showCost ? `£${t.cost}` : `${t.hours}h`}</div>
                          <div style={{ fontFamily: MONO, fontSize: 8, color: MC.ink4, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.count} on</div>
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
          <div style={{ position: 'absolute', bottom: 16, left: 12, right: 12, zIndex: 30, background: MC.ink, color: '#fff', borderRadius: 15, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(9,18,13,0.34)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{pendingChanges} unpublished {pendingChanges === 1 ? 'change' : 'changes'}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>Staff won't see them yet</div>
            </div>
            <button onClick={() => { setPendingChanges(0); reload() }} disabled={publishing} style={{ height: 40, padding: '0 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.75)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={publish} disabled={publishing} style={{ height: 40, padding: '0 18px', borderRadius: 11, border: 'none', cursor: 'pointer', background: '#fff', color: MC.ink, fontFamily: SANS, fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
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
