import React, { useState, useRef, useCallback, useEffect } from 'react'
import { format, addWeeks, subWeeks, isToday, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useShifts, useStaffList, shiftDurationHours } from '../../hooks/useShifts'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { getWeekStart, getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'

// ── Design tokens ────────────────────────────────────────────────────────────
const MC = {
  brand: '#13362a', brandTint: '#eef4f0',
  ink: '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  bg: '#f3f3ef', paper: '#ffffff',
  line: '#e4e6e2', line2: '#eef0ec',
  good: '#1a7a4c', goodBg: '#e3f0e7',
  warn: '#a85d12', warnBg: '#fbeedc',
  bad: '#b3331c', badBg: '#fbeae6',
}
const MONO = "'Geist Mono', ui-monospace, monospace"

// Station colours
const STATIONS = {
  kitchen: { bg: '#f0ebde', fg: '#6b5028', label: 'Kitchen' },
  foh:     { bg: '#e7eef3', fg: '#2a4a66', label: 'FOH' },
  bar:     { bg: '#eaeae6', fg: '#3a3a30', label: 'Bar' },
  kp:      { bg: '#ecdfe1', fg: '#5a3036', label: 'KP' },
  default: { bg: MC.brandTint, fg: MC.brand, label: '' },
}

function stationFromRole(role) {
  if (!role) return STATIONS.default
  const r = role.toLowerCase()
  if (r.includes('kitchen') || r.includes('chef') || r.includes('cook')) return STATIONS.kitchen
  if (r.includes('kp') || r.includes('kitchen porter')) return STATIONS.kp
  if (r.includes('bar')) return STATIONS.bar
  if (r.includes('foh') || r.includes('floor') || r.includes('server') || r.includes('host')) return STATIONS.foh
  return STATIONS.default
}

// Column widths
const STAFF_COL = 96
const DAY_COL   = 74

// ── ScrollWheelPicker ────────────────────────────────────────────────────────
function ScrollWheelPicker({ value, options, onChange, label }) {
  const ref = useRef(null)
  const ITEM_H = 36

  useEffect(() => {
    const idx = options.indexOf(value)
    if (ref.current && idx >= 0) {
      ref.current.scrollTop = idx * ITEM_H
    }
  }, [value, options])

  const handleScroll = useCallback(() => {
    if (!ref.current) return
    const idx = Math.round(ref.current.scrollTop / ITEM_H)
    const clamped = Math.max(0, Math.min(idx, options.length - 1))
    onChange(options[clamped])
  }, [options, onChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: MC.ink3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ position: 'relative', width: 60, height: ITEM_H * 3, overflow: 'hidden' }}>
        {/* fade top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H, background: 'linear-gradient(to bottom, rgba(255,255,255,0.9), transparent)', zIndex: 2, pointerEvents: 'none' }} />
        {/* highlight band */}
        <div style={{ position: 'absolute', top: ITEM_H, left: 0, right: 0, height: ITEM_H, background: MC.brandTint, borderRadius: 8, zIndex: 1 }} />
        {/* fade bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H, background: 'linear-gradient(to top, rgba(255,255,255,0.9), transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div
          ref={ref}
          onScroll={handleScroll}
          style={{
            position: 'absolute', inset: 0, overflowY: 'scroll',
            scrollSnapType: 'y mandatory', paddingTop: ITEM_H, paddingBottom: ITEM_H,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}
        >
          {options.map((o) => (
            <div key={o} style={{
              height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              scrollSnapAlign: 'center', fontFamily: MONO, fontSize: 16, fontWeight: 600,
              color: o === value ? MC.brand : MC.ink3, zIndex: 3, position: 'relative',
            }}>{o}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

// ── ShiftSheet ───────────────────────────────────────────────────────────────
function ShiftSheet({ shift, staffMember, day, venueId, onClose, onSaved, onDeleted }) {
  const [startH, setStartH] = useState(shift?.start_time?.slice(0, 2) ?? '09')
  const [startM, setStartM] = useState(
    MINUTES.reduce((prev, m) => (Math.abs(+m - +(shift?.start_time?.slice(3, 5) ?? '0')) < Math.abs(+prev - +(shift?.start_time?.slice(3, 5) ?? '0')) ? m : prev), '00')
  )
  const [endH, setEndH] = useState(shift?.end_time?.slice(0, 2) ?? '17')
  const [endM, setEndM] = useState(
    MINUTES.reduce((prev, m) => (Math.abs(+m - +(shift?.end_time?.slice(3, 5) ?? '0')) < Math.abs(+prev - +(shift?.end_time?.slice(3, 5) ?? '0')) ? m : prev), '00')
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const startTime = `${startH}:${startM}`
  const endTime   = `${endH}:${endM}`

  const save = async () => {
    setSaving(true)
    const payload = {
      venue_id:   venueId,
      staff_id:   staffMember?.id ?? null,
      shift_date: format(day, 'yyyy-MM-dd'),
      week_start: format(getWeekStart(day), 'yyyy-MM-dd'),
      start_time: startTime,
      end_time:   endTime,
    }
    let error
    if (shift?.id) {
      ;({ error } = await supabase.from('shifts').update({ start_time: startTime, end_time: endTime }).eq('id', shift.id))
    } else {
      ;({ error } = await supabase.from('shifts').insert(payload))
    }
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(shift?.id ? 'Shift updated ✓' : 'Shift added ✓')
    onSaved()
    onClose()
  }

  const del = async () => {
    if (!shift?.id) { onClose(); return }
    setDeleting(true)
    const { error } = await supabase.from('shifts').delete().eq('id', shift.id)
    setDeleting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Shift removed')
    onDeleted()
    onClose()
  }

  const hours = shiftDurationHours(startTime, endTime)

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,26,20,0.45)', zIndex: 40 }} />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 41,
        background: MC.paper, borderRadius: '20px 20px 0 0',
        padding: '8px 20px 32px',
        boxShadow: '0 -4px 32px rgba(13,26,20,0.14)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: MC.line, margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: MC.ink }}>
            {staffMember?.name ?? 'Unassigned'} · {format(day, 'EEE d MMM')}
          </div>
          {shift?.id && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: MC.ink3, marginTop: 3 }}>
              {shift.start_time?.slice(0,5)}–{shift.end_time?.slice(0,5)}
            </div>
          )}
        </div>

        {/* Pickers */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <ScrollWheelPicker value={startH} options={HOURS}   onChange={setStartH} label="Start H" />
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: MC.ink2, paddingBottom: 8 }}>:</div>
            <ScrollWheelPicker value={startM} options={MINUTES} onChange={setStartM} label="Start M" />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: MC.ink4, paddingBottom: 8 }}>–</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <ScrollWheelPicker value={endH} options={HOURS}   onChange={setEndH} label="End H" />
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: MC.ink2, paddingBottom: 8 }}>:</div>
            <ScrollWheelPicker value={endM} options={MINUTES} onChange={setEndM} label="End M" />
          </div>
        </div>

        {hours > 0 && (
          <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 11, color: MC.ink3, marginBottom: 16 }}>
            {hours.toFixed(1)}h shift
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {shift?.id && (
            <button
              onClick={del}
              disabled={deleting}
              style={{
                flex: 1, height: 48, borderRadius: 13, border: `1px solid ${MC.bad}33`,
                background: MC.badBg, color: MC.bad, fontWeight: 600, fontSize: 14,
                cursor: 'pointer',
              }}
            >{deleting ? '…' : 'Remove'}</button>
          )}
          <button
            onClick={save}
            disabled={saving || hours <= 0}
            style={{
              flex: 2, height: 48, borderRadius: 13, border: 'none',
              background: MC.brand, color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: saving ? 'default' : 'pointer', opacity: hours <= 0 ? 0.5 : 1,
            }}
          >{saving ? '…' : (shift?.id ? 'Save changes' : 'Add shift')}</button>
        </div>
      </div>
    </>
  )
}

// ── SwapSheet ────────────────────────────────────────────────────────────────
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
    if (staffIds.length) {
      sendPush({ venueId, notificationType: 'shift_swap_decision', title: 'Shift Swap Approved', body: 'Your shift swap has been approved.', url: '/rota', staffIds }).catch(() => {})
    }
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,26,20,0.45)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 41,
        background: MC.paper, borderRadius: '20px 20px 0 0',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 32px rgba(13,26,20,0.14)',
      }}>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: MC.line, margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: MC.ink, marginBottom: 12 }}>Swap requests</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 32px' }}>
          {pending.length === 0 ? (
            <div style={{ color: MC.ink3, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No pending swaps</div>
          ) : pending.map(swap => (
            <div key={swap.id} style={{ padding: '14px 0', borderBottom: `1px solid ${MC.line}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: MC.ink, marginBottom: 4 }}>
                {swap.requester_name ?? 'Staff'} → {swap.target_staff_name ?? 'Staff'}
              </div>
              {swap.shift && (
                <div style={{ fontFamily: MONO, fontSize: 11, color: MC.ink3, marginBottom: 8 }}>
                  {swap.shift.shift_date} · {swap.shift.start_time?.slice(0,5)}–{swap.shift.end_time?.slice(0,5)}
                </div>
              )}
              {swap.message && (
                <div style={{ fontSize: 12, color: MC.ink3, fontStyle: 'italic', marginBottom: 8 }}>"{swap.message}"</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => decline(swap)}
                  disabled={resolving === swap.id}
                  style={{
                    flex: 1, height: 38, borderRadius: 10, border: `1px solid ${MC.line}`,
                    background: MC.paper, color: MC.ink2, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >Decline</button>
                <button
                  onClick={() => approve(swap)}
                  disabled={resolving === swap.id}
                  style={{
                    flex: 2, height: 38, borderRadius: 10, border: 'none',
                    background: MC.brand, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >{resolving === swap.id ? '…' : 'Approve'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── ShiftCell ────────────────────────────────────────────────────────────────
function ShiftCell({ shift, hasSwapRequest, onTap }) {
  if (!shift) {
    return (
      <button
        onClick={onTap}
        style={{
          width: DAY_COL - 8, height: 52, margin: '0 4px',
          borderRadius: 9, border: `1.5px dashed ${MC.line}`,
          background: 'transparent', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MC.line} strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    )
  }

  const st = stationFromRole(shift.role)
  return (
    <button
      onClick={onTap}
      style={{
        width: DAY_COL - 8, height: 52, margin: '0 4px',
        borderRadius: 9, background: st.bg,
        border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
        overflow: 'hidden', textAlign: 'left',
        display: 'flex', alignItems: 'stretch',
      }}
    >
      {/* Left accent */}
      <div style={{ width: 3, background: st.fg, borderRadius: '9px 0 0 9px', flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '5px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: st.fg, lineHeight: 1.3 }}>
          {shift.start_time?.slice(0,5)}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: st.fg, opacity: 0.7, lineHeight: 1.3 }}>
          {shift.end_time?.slice(0,5)}
        </div>
      </div>
      {/* Swap dot */}
      {hasSwapRequest && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 6, height: 6, borderRadius: 3, background: MC.warn,
        }} />
      )}
    </button>
  )
}

// ── RotaMobileGrid ───────────────────────────────────────────────────────────
export default function RotaMobileGrid() {
  const { venueId } = useVenue()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const days = getWeekDays(weekStart)
  const [shiftSheet, setShiftSheet] = useState(null) // { shift, staffMember, day }
  const [showSwaps, setShowSwaps] = useState(false)
  const { toast } = useToast()

  const { shifts, loading, reload } = useShifts(weekStart, 1)
  const { staff, loading: staffLoading } = useStaffList()
  const { swaps, pendingCount, reload: reloadSwaps } = useShiftSwaps()

  const prevWeek = () => setWeekStart(w => subWeeks(w, 1))
  const nextWeek = () => setWeekStart(w => addWeeks(w, 1))

  // Build a lookup: staff_id + date → shift
  const shiftMap = {}
  for (const s of shifts) {
    const key = `${s.staff_id ?? 'unassigned'}|${s.shift_date}`
    shiftMap[key] = s
  }

  // Swap lookup: shift_id → boolean
  const swapShiftIds = new Set(swaps.filter(s => s.status === 'pending').map(s => s.shift_id))

  // Hours per day across all staff
  const hoursPerDay = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return shifts
      .filter(s => s.shift_date === dateStr)
      .reduce((sum, s) => sum + shiftDurationHours(s.start_time, s.end_time), 0)
  })

  const headcountPerDay = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return shifts.filter(s => s.shift_date === dateStr && s.staff_id).length
  })

  const isLoading = loading || staffLoading

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: MC.bg, overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        background: MC.brand, color: '#fff',
        padding: '12px 16px 10px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={prevWeek} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1L1 5l4 4"/></svg>
            </button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>
                Week of {format(weekStart, 'd MMM')}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
                {format(weekStart, 'yyyy')}
              </div>
            </div>
            <button onClick={nextWeek} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4"/></svg>
            </button>
          </div>
          {/* Published badge */}
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px' }}>
            Draft
          </div>
        </div>
      </div>

      {/* Swap banner */}
      {pendingCount > 0 && (
        <button
          onClick={() => setShowSwaps(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', background: MC.warnBg, border: 'none', cursor: 'pointer',
            borderBottom: `1px solid ${MC.warn}33`, flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: MC.warn }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: MC.warn }}>
              {pendingCount} swap {pendingCount === 1 ? 'request' : 'requests'} pending
            </span>
          </div>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={MC.warn} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4"/></svg>
        </button>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MC.ink3, fontSize: 14 }}>
            Loading…
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: STAFF_COL + DAY_COL * 7, paddingBottom: 80 }}>

              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'stretch',
                position: 'sticky', top: 0, zIndex: 10,
                background: MC.paper, borderBottom: `1px solid ${MC.line}`,
              }}>
                {/* Staff col header */}
                <div style={{
                  width: STAFF_COL, minWidth: STAFF_COL, flexShrink: 0,
                  position: 'sticky', left: 0, zIndex: 11,
                  background: MC.paper, borderRight: `1px solid ${MC.line}`,
                  padding: '8px 10px', display: 'flex', alignItems: 'center',
                }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: MC.ink3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Staff</span>
                </div>
                {/* Day headers */}
                {days.map((day, i) => {
                  const today = isToday(day)
                  return (
                    <div key={i} style={{
                      width: DAY_COL, minWidth: DAY_COL, flexShrink: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '7px 0 6px', borderRight: i < 6 ? `1px solid ${MC.line2}` : 'none',
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: today ? MC.brand : MC.ink4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {format(day, 'EEE')}
                      </span>
                      <div style={{
                        width: 26, height: 26, borderRadius: 13, marginTop: 3,
                        background: today ? MC.brand : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: today ? '#fff' : MC.ink2 }}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Staff rows */}
              {staff.map((member) => (
                <div key={member.id} style={{
                  display: 'flex', alignItems: 'center',
                  borderBottom: `1px solid ${MC.line2}`, minHeight: 64,
                }}>
                  {/* Staff name cell */}
                  <div style={{
                    width: STAFF_COL, minWidth: STAFF_COL, flexShrink: 0,
                    position: 'sticky', left: 0, zIndex: 2,
                    background: MC.paper, borderRight: `1px solid ${MC.line}`,
                    padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: MC.brandTint, color: MC.brand,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: MONO, fontSize: 10, fontWeight: 600,
                    }}>
                      {(member.name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: MC.ink, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.name?.split(' ')[0] ?? '—'}
                      </div>
                      {member.job_role && (
                        <div style={{ fontFamily: MONO, fontSize: 9, color: MC.ink3, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {member.job_role}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Shift cells */}
                  {days.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const key = `${member.id}|${dateStr}`
                    const shift = shiftMap[key] ?? null
                    const hasSwap = shift && swapShiftIds.has(shift.id)
                    return (
                      <div key={i} style={{ width: DAY_COL, minWidth: DAY_COL, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0', borderRight: i < 6 ? `1px solid ${MC.line2}` : 'none' }}>
                        <ShiftCell
                          shift={shift}
                          hasSwapRequest={hasSwap}
                          onTap={() => setShiftSheet({ shift, staffMember: member, day })}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Totals row */}
              <div style={{ display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${MC.line}`, background: MC.paper, position: 'sticky', bottom: 0, zIndex: 5 }}>
                <div style={{
                  width: STAFF_COL, minWidth: STAFF_COL, flexShrink: 0,
                  position: 'sticky', left: 0, zIndex: 6,
                  background: MC.paper, borderRight: `1px solid ${MC.line}`,
                  padding: '8px 10px',
                }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: MC.ink3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Totals</span>
                </div>
                {days.map((day, i) => (
                  <div key={i} style={{
                    width: DAY_COL, minWidth: DAY_COL, flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '6px 0', borderRight: i < 6 ? `1px solid ${MC.line2}` : 'none',
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: MC.ink2 }}>
                      {hoursPerDay[i].toFixed(0)}h
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: MC.ink4, marginTop: 2 }}>
                      {headcountPerDay[i]} staff
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Shift sheet */}
      {shiftSheet && (
        <ShiftSheet
          shift={shiftSheet.shift}
          staffMember={shiftSheet.staffMember}
          day={shiftSheet.day}
          venueId={venueId}
          onClose={() => setShiftSheet(null)}
          onSaved={reload}
          onDeleted={reload}
        />
      )}

      {/* Swap sheet */}
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
