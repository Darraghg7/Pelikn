import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import RotaMobileGrid from './RotaMobileGrid'
import { format, addWeeks, eachDayOfInterval, parseISO, isBefore, startOfDay } from 'date-fns'
import { useClockSessions } from '../../hooks/useClockSessions'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useShifts, useStaffList, shiftDurationHours, paidShiftHours, unpaidBreakMins } from '../../hooks/useShifts'
import { useCrossVenueShifts } from '../../hooks/useCrossVenueShifts'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { useAvailability } from '../../hooks/useAvailability'
import { useSession } from '../../contexts/SessionContext'
import { getWeekStart, getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import { useAppSettings } from '../../hooks/useSettings'
import { useVenueRoles, loadAllStaffRolesForVenue } from '../../hooks/useVenueRoles'
import RotaWeekView from './RotaWeekView'
import { shareRotaImage } from '../../lib/rotaImageExport'
import RotaBuilderModal from './RotaBuilderModal'
import RotaAIModal from './RotaAIModal'
import RotaConfigModal from './RotaConfigModal'
import RotaToolbar from './RotaToolbar'
import RotaShiftModal from './RotaShiftModal'
import RotaSwapPanel from './RotaSwapPanel'
import RotaSwapRequestModal from './RotaSwapRequestModal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useDutyTemplates } from '../../hooks/useDuties'

function durationLabel(start, end) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function GanttChart({ shifts, staff, currentStaffId, nowMins, showNow }) {
  const winStart = 6 * 60, winEnd = 24 * 60, winSpan = winEnd - winStart
  const pct = (mins) => Math.max(0, Math.min(100, ((mins - winStart) / winSpan) * 100))
  const nowPct = pct(nowMins)
  const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return (h < 4 ? h + 24 : h) * 60 + m }
  const ticks = [6, 9, 12, 15, 18, 21, 24]
  const sorted = [...shifts].sort((a, b) => {
    const aMe = a.staff_id === currentStaffId, bMe = b.staff_id === currentStaffId
    if (aMe !== bMe) return aMe ? -1 : 1
    return a.start_time.localeCompare(b.start_time)
  })
  return (
    <div className="bg-white border border-charcoal/10 rounded-2xl overflow-hidden">
      <div className="flex items-baseline gap-2.5 px-3.5 pt-3 pb-2">
        <div className="w-16 shrink-0" />
        <div className="flex-1 relative h-3.5">
          {ticks.map(h => {
            const p = pct(h * 60)
            return (
              <span key={h} className="absolute top-0 font-mono text-[10px] text-charcoal/40 font-semibold tracking-[0.04em]"
                style={{ left: `${p}%`, transform: h === 6 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {String(h).padStart(2, '0')}
              </span>
            )
          })}
          {showNow && (
            <span className="absolute top-0 font-mono text-[9px] text-accent font-bold tracking-[0.06em] bg-white px-1 z-10"
              style={{ left: `${nowPct}%`, transform: 'translateX(-50%)' }}>
              NOW
            </span>
          )}
        </div>
        <div className="w-28 shrink-0" />
      </div>
      <div className="px-3.5 pb-3.5">
        {sorted.map((shift) => {
          const staffMember = staff.find(s => s.id === shift.staff_id)
          const isMe = shift.staff_id === currentStaffId
          const sMin = timeToMin(shift.start_time)
          let eMin = timeToMin(shift.end_time); if (eMin < sMin) eMin += 24 * 60
          const left = pct(sMin), right = pct(eMin), width = Math.max(right - left, 4)
          return (
            <div key={shift.id} className={`flex items-center gap-2.5 h-[38px] rounded-lg -mx-1.5 px-1.5 ${isMe ? 'bg-brand/8' : ''}`}>
              <div className={`w-16 shrink-0 text-[13px] font-semibold truncate flex items-center gap-1 ${isMe ? 'text-brand' : 'text-charcoal/70'}`}>
                <span className="truncate">{(staffMember?.name ?? 'Staff').split(' ')[0]}</span>
                {isMe && <span className="font-mono text-[8px] text-accent font-bold tracking-[0.08em] bg-danger/8 px-1 py-0.5 rounded shrink-0">YOU</span>}
              </div>
              <div className="flex-1 relative h-[22px]">
                {ticks.map((h, ti) => {
                  const p = pct(h * 60)
                  if (p <= 0.5 || p >= 99.5) return null
                  return <span key={ti} className="absolute top-[-8px] bottom-[-8px] w-px bg-charcoal/8 z-0" style={{ left: `${p}%` }} />
                })}
                {showNow && <span className="absolute top-[-8px] bottom-[-8px] z-10" style={{ left: `${nowPct}%`, width: '1.5px', background: '#c94f2a' }} />}
                <div className="absolute top-0 h-[22px] rounded-full z-20"
                  style={{ left: `${left}%`, width: `${width}%`, background: isMe ? '#13362a' : '#e4e6e2', boxShadow: isMe ? '0 1px 4px rgba(19,54,42,0.3)' : 'none' }} />
              </div>
              <div className="w-28 shrink-0 text-right">
                <div className={`font-mono text-[12px] font-semibold tabular-nums ${isMe ? 'text-brand' : 'text-charcoal/60'}`}>
                  {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                </div>
                {shift.role_label && (
                  <div className="font-mono text-[10px] text-charcoal/50 tracking-[0.05em] font-semibold mt-0.5 uppercase truncate">{shift.role_label}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   EDIT HOURS — helpers + sub-components (staff Rota only)
───────────────────────────────────────────────────────────────── */

const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90]
const EDIT_REASONS  = ['Forgot to clock out', 'Clocked in early', 'Wrong times', 'Other']

function ehWorkedMins(startStr, endStr, brkMins) {
  const [sh, sm] = startStr.split(':').map(Number)
  const [eh, em] = endStr.split(':').map(Number)
  let d = (eh * 60 + em) - (sh * 60 + sm)
  if (d < 0) d += 1440
  return d - (brkMins || 0)
}
function ehDurLabel(mins) {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60), m = mins % 60
  if (h && m) return `${h}h ${m}m`
  return h ? `${h}h` : `${m}m`
}
function ehSignedLabel(mins) {
  const abs = Math.abs(mins)
  return (mins < 0 ? '−' : '+') + ehDurLabel(abs)
}
function fmtHM(date) {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
function applyTimeToDate(baseDate, timeStr) {
  const d = new Date(baseDate)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

/* scroll-snap wheel picker */
const WHEEL_IH = 36, WHEEL_VIS = 5
const WHEEL_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2,'0'))
const WHEEL_MINS  = Array.from({ length: 60 }, (_, i) => String(i).padStart(2,'0'))

function EHWheel({ values, value, onChange }) {
  const ref   = React.useRef(null)
  const timer = React.useRef(null)
  const idx   = Math.max(0, values.indexOf(value))
  React.useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = idx * WHEEL_IH }, [value]) // eslint-disable-line
  const onScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current; if (!el) return
      const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / WHEEL_IH)))
      if (el.scrollTop !== i * WHEEL_IH) el.scrollTo({ top: i * WHEEL_IH, behavior: 'smooth' })
      if (values[i] !== value) onChange(values[i])
    }, 80)
  }
  const pad = ((WHEEL_VIS - 1) / 2) * WHEEL_IH
  return (
    <div style={{ position: 'relative', height: WHEEL_VIS * WHEEL_IH, flex: 1 }}>
      <div ref={ref} onScroll={onScroll} style={{
        height: WHEEL_VIS * WHEEL_IH, overflowY: 'scroll', scrollSnapType: 'y mandatory',
        padding: `${pad}px 0`, scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {values.map((v, i) => {
          const on = v === value
          return (
            <div key={v}
              onClick={() => { ref.current.scrollTo({ top: i * WHEEL_IH, behavior: 'smooth' }); onChange(v) }}
              className="font-mono tabular-nums"
              style={{
                height: WHEEL_IH, display: 'flex', alignItems: 'center', justifyContent: 'center',
                scrollSnapAlign: 'center', cursor: 'pointer',
                fontVariantNumeric: 'tabular-nums',
                fontSize: on ? 23 : 18, fontWeight: on ? 600 : 500,
                color: on ? '#0d1a14' : '#b3b9b5', transition: 'font-size .1s, color .1s',
              }}
            >{v}</div>
          )
        })}
      </div>
      {/* centre band */}
      <div style={{ position:'absolute', left:0, right:0, top: pad, height: WHEEL_IH, pointerEvents:'none', borderTop:'1px solid #e4e6e2', borderBottom:'1px solid #e4e6e2', background:'rgba(19,54,42,0.03)' }} />
      {/* top fade */}
      <div style={{ position:'absolute', left:0, right:0, top:0, height: pad, pointerEvents:'none', background:'linear-gradient(#f3f3ef,#f3f3ef00)' }} />
      {/* bottom fade */}
      <div style={{ position:'absolute', left:0, right:0, bottom:0, height: pad, pointerEvents:'none', background:'linear-gradient(#f3f3ef00,#f3f3ef)' }} />
    </div>
  )
}

/* status pill */
function EHStatusPill({ status }) {
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full tracking-[0.05em] uppercase">
      <span className="w-1.5 h-1.5 rounded-full bg-warning" />Pending approval
    </span>
  )
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full tracking-[0.05em] uppercase">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Adjusted
    </span>
  )
  if (status === 'denied') return (
    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full tracking-[0.05em] uppercase">
      Not approved
    </span>
  )
  return null
}

/* Fix-hours bottom sheet */
function timeDiffMins(a, b) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  let d = (bh * 60 + bm) - (ah * 60 + am)
  if (d < 0) d += 1440
  return d
}

function FixHoursSheet({ ctx, onClose, onSubmit }) {
  const [start, setStart]       = React.useState('')
  const [end, setEnd]           = React.useState('')
  const [brkStart, setBrkStart] = React.useState('')
  const [brkEnd, setBrkEnd]     = React.useState('')
  const [hasBreak, setHasBreak] = React.useState(false)
  const [edge, setEdge]         = React.useState('end')
  const [reason, setReason]     = React.useState('')
  const [note, setNote]         = React.useState('')
  const [confirming, setConfirming] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!ctx) return
    const s = fmtHM(ctx.session.clockInAt)
    const e = ctx.session.clockOutAt ? fmtHM(ctx.session.clockOutAt) : '00:00'
    setStart(s)
    setEnd(e)
    const origBrk = ctx.session.breakMinutes ?? 0
    if (origBrk > 0) {
      // Derive break start/end from clock-in + first break heuristic
      const [sh, sm] = s.split(':').map(Number)
      const midMins = sh * 60 + sm + Math.floor(timeDiffMins(s, e) / 2) - Math.floor(origBrk / 2)
      const bsH = String(Math.floor((midMins % 1440) / 60)).padStart(2, '0')
      const bsM = String(midMins % 60).padStart(2, '0')
      const beM = midMins + origBrk
      const beH = String(Math.floor((beM % 1440) / 60)).padStart(2, '0')
      const beMm = String(beM % 60).padStart(2, '0')
      setBrkStart(`${bsH}:${bsM}`)
      setBrkEnd(`${beH}:${beMm}`)
      setHasBreak(true)
    } else {
      setBrkStart('')
      setBrkEnd('')
      setHasBreak(false)
    }
    setEdge('end')
    setReason('')
    setNote('')
    setConfirming(false)
  }, [ctx])

  if (!ctx) return null
  const { session, role } = ctx
  const origStart = fmtHM(session.clockInAt)
  const origEnd   = session.clockOutAt ? fmtHM(session.clockOutAt) : '--:--'
  const origBrk   = session.breakMinutes ?? 0
  const recMins   = session.clockOutAt ? ehWorkedMins(origStart, origEnd, origBrk) : 0

  const brk = hasBreak && brkStart && brkEnd ? timeDiffMins(brkStart, brkEnd) : 0
  const newMins   = ehWorkedMins(start, end, brk)
  const delta     = newMins - recMins
  const changed   = start !== origStart || end !== origEnd || brk !== origBrk
  const invalid   = newMins <= 0 || (hasBreak && brk <= 0)
  const needReason = changed && Math.abs(delta) > 0
  const canSubmit = changed && !invalid && (!needReason || reason)

  const getEdgeTime = (e) => {
    if (e === 'start') return start
    if (e === 'end') return end
    if (e === 'brkStart') return brkStart || start
    return brkEnd || end
  }
  const setEdgeTime = (e, val) => {
    if (e === 'start') setStart(val)
    else if (e === 'end') setEnd(val)
    else if (e === 'brkStart') setBrkStart(val)
    else setBrkEnd(val)
  }

  const curTime = getEdgeTime(edge)
  const [ch, cm] = curTime ? curTime.split(':') : ['00', '00']
  const setCur = (h, m) => setEdgeTime(edge, `${h}:${m}`)

  const doSubmit = async () => {
    setSubmitting(true)
    await onSubmit(session, { start, end, brk, reason, note, newMins, delta })
    setSubmitting(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(9,18,13,0.42)' }} />
      <div style={{
        position:'relative', background:'#f3f3ef', borderRadius:'22px 22px 0 0',
        padding:'10px 16px env(safe-area-inset-bottom,24px)', maxHeight:'92dvh', overflowY:'auto',
        animation:'ehSlideUp 0.32s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <style>{`@keyframes ehSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        {/* grab handle */}
        <div style={{ width:38, height:4, borderRadius:2, background:'#e4e6e2', margin:'0 auto 16px' }} />

        {/* header */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold tracking-[-0.015em]">Fix hours</div>
            <div className="text-[12px] text-charcoal/50 mt-0.5">{format(session.date, 'EEEE, d MMMM')}{role ? ` · ${role}` : ''}</div>
          </div>
          <span className="font-mono text-[9.5px] font-bold text-warning bg-warning/10 px-2.5 py-1 rounded-full tracking-[0.05em] uppercase">Recorded</span>
        </div>

        {/* recorded reference strip */}
        <div className="mt-3 flex items-center justify-between bg-white border border-charcoal/10 rounded-[11px] px-3 py-2.5">
          <span className="text-[11.5px] text-charcoal/50">On the clock</span>
          <span className="font-mono text-[12.5px] font-semibold tabular-nums text-charcoal/70">
            {origStart}–{origEnd} · {ehDurLabel(recMins)}
          </span>
        </div>

        {/* start/end toggle */}
        <div className="flex gap-2 mt-3.5 bg-charcoal/8 p-1 rounded-xl">
          {[['start','Clock in', start], ['end','Clock out', end]].map(([k, label, val]) => {
            const on = edge === k
            return (
              <button key={k} onClick={() => setEdge(k)} className="flex-1 rounded-[9px] py-2 transition-all"
                style={{ background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 3px rgba(9,18,13,0.1)' : 'none', border:'none', cursor:'pointer' }}>
                <div className="font-mono text-[9px] text-charcoal/50 uppercase tracking-[0.06em] font-semibold">{label}</div>
                <div className="font-mono text-[17px] font-semibold tabular-nums mt-0.5" style={{ color: on ? '#13362a' : '#76817b' }}>{val}</div>
              </button>
            )
          })}
        </div>

        {/* scroll wheels — shift times */}
        {(edge === 'start' || edge === 'end') && (
          <div className="flex items-center justify-center gap-1 mt-2.5">
            <EHWheel values={WHEEL_HOURS} value={ch} onChange={(h) => setCur(h, cm)} />
            <span className="font-mono text-[21px] font-semibold text-charcoal/40 pb-0.5">:</span>
            <EHWheel values={WHEEL_MINS} value={cm} onChange={(m) => setCur(ch, m)} />
          </div>
        )}

        {/* break section */}
        <div className="mt-3">
          <div className="flex items-center justify-between px-0.5 pb-2">
            <div className="font-mono text-[9.5px] text-charcoal/50 uppercase tracking-[0.06em] font-semibold">Unpaid break</div>
            <button
              onClick={() => {
                if (hasBreak) {
                  setHasBreak(false)
                  setEdge(edge === 'brkStart' || edge === 'brkEnd' ? 'start' : edge)
                } else {
                  // default break start to middle of shift
                  const [sh, sm] = start.split(':').map(Number)
                  const shiftMid = sh * 60 + sm + Math.floor(timeDiffMins(start, end) / 2)
                  const bsH = String(Math.floor((shiftMid % 1440) / 60)).padStart(2, '0')
                  const bsM = String(shiftMid % 60).padStart(2, '0')
                  const beM = shiftMid + 30
                  const beH = String(Math.floor((beM % 1440) / 60)).padStart(2, '0')
                  const beMm = String(beM % 60).padStart(2, '0')
                  setBrkStart(`${bsH}:${bsM}`)
                  setBrkEnd(`${beH}:${beMm}`)
                  setHasBreak(true)
                  setEdge('brkStart')
                }
              }}
              className="font-mono text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
              style={{ border: `1px solid ${hasBreak ? '#b3331c' : '#e4e6e2'}`, background: hasBreak ? '#fbeae6' : '#fff', color: hasBreak ? '#b3331c' : '#76817b', cursor: 'pointer' }}
            >
              {hasBreak ? 'Remove break' : '+ Add break'}
            </button>
          </div>
          {hasBreak && (
            <>
              <div className="flex gap-2 bg-charcoal/8 p-1 rounded-xl">
                {[['brkStart', 'Break start', brkStart], ['brkEnd', 'Break end', brkEnd]].map(([k, label, val]) => {
                  const on = edge === k
                  return (
                    <button key={k} onClick={() => setEdge(k)} className="flex-1 rounded-[9px] py-2 transition-all"
                      style={{ background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 3px rgba(9,18,13,0.1)' : 'none', border: 'none', cursor: 'pointer' }}>
                      <div className="font-mono text-[9px] text-charcoal/50 uppercase tracking-[0.06em] font-semibold">{label}</div>
                      <div className="font-mono text-[17px] font-semibold tabular-nums mt-0.5" style={{ color: on ? '#13362a' : '#76817b' }}>{val || '--:--'}</div>
                    </button>
                  )
                })}
              </div>
              {(edge === 'brkStart' || edge === 'brkEnd') && (
                <div className="flex items-center justify-center gap-1 mt-2.5">
                  <EHWheel values={WHEEL_HOURS} value={ch} onChange={(h) => setCur(h, cm)} />
                  <span className="font-mono text-[21px] font-semibold text-charcoal/40 pb-0.5">:</span>
                  <EHWheel values={WHEEL_MINS} value={cm} onChange={(m) => setCur(ch, m)} />
                </div>
              )}
              {brk > 0 && (
                <div className="mt-1.5 text-center font-mono text-[11.5px] text-charcoal/50">{ehDurLabel(brk)} break</div>
              )}
              {brk <= 0 && brkStart && brkEnd && (
                <div className="mt-1.5 text-center font-mono text-[11.5px] text-danger">Break end must be after break start</div>
              )}
            </>
          )}
        </div>

        {/* live delta strip */}
        <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl"
          style={{ background: invalid ? '#fbeae6' : changed ? '#eef4f0' : '#fff', border: `1px solid ${invalid ? '#b3331c40' : '#e4e6e2'}` }}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[15px] font-bold tabular-nums text-charcoal">{start}–{end}</span>
            <span className="text-[12.5px]" style={{ color: invalid ? '#b3331c' : '#76817b' }}>
              {invalid ? (newMins <= 0 ? 'clock-out must be after clock-in' : 'invalid break times') : ehDurLabel(newMins)}
            </span>
          </div>
          {!invalid && changed && (
            <span className="font-mono text-[12.5px] font-bold" style={{ color: delta < 0 ? '#b3331c' : '#1a7a4c' }}>
              {ehSignedLabel(delta)}
            </span>
          )}
        </div>

        {/* reason chips */}
        {needReason && (
          <div className="mt-3.5">
            <div className="font-mono text-[9.5px] text-charcoal/50 uppercase tracking-[0.06em] font-semibold px-0.5 pb-1.5">Reason for change</div>
            <div className="flex flex-wrap gap-1.5">
              {EDIT_REASONS.map(r => {
                const on = r === reason
                return (
                  <button key={r} onClick={() => setReason(r)}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors"
                    style={{ border: `1px solid ${on ? '#13362a' : '#e4e6e2'}`, background: on ? '#eef4f0' : '#fff', color: on ? '#13362a' : '#3d4a44', cursor:'pointer' }}>
                    {r}
                  </button>
                )
              })}
            </div>
            <input
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add a note for your manager (optional)"
              className="w-full mt-2.5 px-3 py-2.5 rounded-[10px] border border-charcoal/10 bg-white text-[13px] text-charcoal outline-none"
            />
          </div>
        )}

        {/* approval info */}
        <div className="mt-3 flex gap-2 items-start px-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76817b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span className="text-[11.5px] text-charcoal/50 leading-snug">
            Your manager reviews this before it changes your pay. Recorded hours stay until approved.
          </span>
        </div>

        {/* actions */}
        <div className="flex gap-2 mt-3.5">
          <button onClick={onClose} className="w-24 h-12 rounded-xl border border-charcoal/10 bg-white text-[14px] font-semibold text-charcoal/70" style={{ cursor:'pointer' }}>
            Cancel
          </button>
          <button
            disabled={!canSubmit || submitting}
            onClick={() => setConfirming(true)}
            className="flex-1 h-12 rounded-xl text-[14.5px] font-bold transition-colors"
            style={{ border:'none', cursor: canSubmit ? 'pointer' : 'not-allowed', background: canSubmit ? '#13362a' : '#e4e6e2', color: canSubmit ? '#fff' : '#b3b9b5' }}>
            Submit for approval
          </button>
        </div>

        {/* confirm sub-sheet */}
        {confirming && (
          <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
            <div onClick={() => setConfirming(false)} style={{ position:'absolute', inset:0, background:'rgba(9,18,13,0.45)' }} />
            <div style={{ position:'relative', background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px 22px 28px', animation:'ehSlideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
              <div className="w-11 h-11 rounded-[13px] bg-warning/10 grid place-items-center mb-3.5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a85d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div className="text-[17px] font-bold tracking-[-0.015em]">Send to your manager</div>
              <p className="text-[13.5px] text-charcoal/50 leading-relaxed mt-2 mb-4">
                You're asking to change {format(session.date, 'EEEE')}'s hours from{' '}
                <strong className="text-charcoal/70">{ehDurLabel(recMins)}</strong> to{' '}
                <strong className="text-charcoal/70">{ehDurLabel(newMins)}</strong> ({ehSignedLabel(delta)}).
                This won't change your pay until it's approved.
              </p>
              <button onClick={doSubmit} disabled={submitting}
                className="w-full h-12 rounded-xl text-[14.5px] font-bold text-white mb-2"
                style={{ background:'#13362a', border:'none', cursor:'pointer' }}>
                {submitting ? 'Sending…' : 'Submit for approval'}
              </button>
              <button onClick={() => setConfirming(false)}
                className="w-full h-[42px] rounded-xl text-[13.5px] font-semibold text-charcoal/50"
                style={{ background:'transparent', border:'none', cursor:'pointer' }}>
                Go back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* per-day worked card (selected day = past with a clock session) */
function DayWorkedCard({ session, role, req }) {
  const origStart = fmtHM(session.clockInAt)
  const origEnd   = session.clockOutAt ? fmtHM(session.clockOutAt) : '--:--'
  const recMins   = session.clockOutAt ? ehWorkedMins(origStart, origEnd, session.breakMinutes ?? 0) : 0
  const status    = req?.status
  const showReq   = status === 'pending' || status === 'approved'
  return (
    <div className="bg-white rounded-2xl p-4" style={{ border:'1px solid rgba(13,26,20,0.20)', boxShadow:'0 1px 3px rgba(13,26,20,0.05)' }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] text-charcoal/50 tracking-[0.1em] uppercase">Hours worked</span>
        {status ? <EHStatusPill status={status} /> : (
          <span className="font-mono text-[9.5px] font-bold text-charcoal/40 bg-charcoal/8 px-2 py-0.5 rounded-full tracking-[0.05em] uppercase">Recorded</span>
        )}
      </div>
      <div className="font-mono text-[30px] font-medium tracking-[-0.025em] tabular-nums mt-2"
        style={{ textDecoration: showReq ? 'line-through' : 'none', opacity: showReq ? 0.45 : 1 }}>
        {origStart} — {origEnd}
      </div>
      <div className="flex items-center gap-2.5 text-[13px] text-charcoal/50 mt-1">
        <span className="font-mono">{ehDurLabel(recMins)}</span>
        <span className="text-charcoal/25">·</span>
        <span>{session.breakMinutes ?? 0}m break</span>
        {role && <><span className="text-charcoal/25">·</span><span>{role}</span></>}
      </div>
      {showReq && req?.start && (
        <div className="mt-2.5 flex items-center justify-between px-3 py-2 rounded-[11px]"
          style={{ background: status === 'approved' ? '#e3f0e7' : '#fbeedc' }}>
          <span className="text-[11.5px] font-semibold" style={{ color: status === 'approved' ? '#1a7a4c' : '#a85d12' }}>
            {status === 'approved' ? 'Updated to' : 'Requested'}
          </span>
          <span className="font-mono text-[12.5px] font-bold tabular-nums" style={{ color: status === 'approved' ? '#1a7a4c' : '#a85d12' }}>
            {req.start}–{req.end} · {ehDurLabel(req.newMins ?? 0)}
          </span>
        </div>
      )}
    </div>
  )
}

/* weekly worked section */
function WorkedSection({ rows, reqs, hourlyRate, onFix, isDateLocked }) {
  const total = rows.reduce((sum, r) => {
    const req = reqs[r.session.clockInId]
    const mins = req?.status === 'approved' ? (req.newMins ?? 0) : r.workedMins
    return sum + mins
  }, 0)
  const pendingCount = Object.values(reqs).filter(r => r.status === 'pending').length

  if (rows.length === 0) return null

  return (
    <div>
      <div className="flex items-baseline justify-between px-1 mb-2">
        <span className="font-mono text-[10.5px] text-charcoal/50 tracking-[0.08em] uppercase font-semibold">This week · worked</span>
        <span className="font-mono text-[11px] text-charcoal/50">{rows.length} logged · so far</span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background:'#fff', border:'1px solid rgba(13,26,20,0.20)', boxShadow:'0 1px 3px rgba(13,26,20,0.05)' }}>
        {rows.map((r, i) => {
          const req    = reqs[r.session.clockInId]
          const status = req?.status
          const showReq = status === 'pending' || status === 'approved'
          return (
            <div key={r.session.clockInId}
              className="flex items-center gap-3 px-3.5 py-3"
              style={{ borderTop: i === 0 ? 'none' : '1px solid #eef0ec' }}>
              {/* date chip */}
              <div className="w-11 h-12 rounded-[9px] bg-charcoal/4 border border-charcoal/10 shrink-0 flex flex-col items-center justify-center gap-0.5">
                <span className="font-mono text-[9px] text-charcoal/50 tracking-[0.06em] font-semibold">{r.dow}</span>
                <span className="font-mono text-[17px] font-semibold text-charcoal leading-none">{r.dateNum}</span>
              </div>
              {/* middle */}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13.5px] font-semibold tabular-nums text-charcoal"
                  style={{ textDecoration: showReq ? 'line-through' : 'none', opacity: showReq ? 0.5 : 1 }}>
                  {r.startStr}–{r.endStr}
                </div>
                <div className="text-[11.5px] text-charcoal/50 mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono">{ehDurLabel(r.workedMins)}</span>
                  {r.role && <><span className="text-charcoal/25">·</span><span>{r.role}</span></>}
                  {(r.session.breakMinutes ?? 0) > 0 && <><span className="text-charcoal/25">·</span><span>{r.session.breakMinutes}m break</span></>}
                </div>
                {showReq && <div className="mt-1"><EHStatusPill status={status} /></div>}
              </div>
              {/* right */}
              {status === 'pending' ? (
                <span className="font-mono text-[12.5px] font-bold text-warning tabular-nums shrink-0">
                  {req.start}–{req.end}
                </span>
              ) : isDateLocked?.(r.session.date) ? (
                <span className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] border border-charcoal/10 text-charcoal/30 text-[11.5px] font-semibold bg-charcoal/4" title="Locked for payroll">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Locked
                </span>
              ) : (
                <button onClick={() => onFix(r.session, r.role)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] border border-charcoal/15 text-charcoal/60 text-[11.5px] font-semibold"
                  style={{ background:'#fff', cursor:'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  Fix
                </button>
              )}
            </div>
          )
        })}
        {/* footer */}
        <div className="flex items-center gap-4 px-3.5 py-3 bg-charcoal/3" style={{ borderTop:'1px solid #eef0ec' }}>
          <div>
            <div className="font-mono text-[9.5px] text-charcoal/50 tracking-[0.06em] uppercase">Worked</div>
            <div className="font-mono text-[14px] font-semibold mt-0.5">{ehDurLabel(total)}</div>
          </div>
          {hourlyRate && (
            <div>
              <div className="font-mono text-[9.5px] text-charcoal/50 tracking-[0.06em] uppercase">Est. Pay</div>
              <div className="font-mono text-[14px] font-semibold mt-0.5 text-success">£{(total / 60 * hourlyRate).toFixed(2)}</div>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="ml-auto font-mono text-[10.5px] font-semibold text-warning">
              {pendingCount} awaiting approval
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   END edit-hours components
───────────────────────────────────────────────────────────────── */

function StaffRotaView({ shifts, staff, loading, weekStart, prevWeek, nextWeek, session, swapModal, setSwapModal, swapForm, setSwapForm, swapSaving, submitSwapRequest, swapCandidates, swaps }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekDays = getWeekDays(weekStart)

  const [selectedDate, setSelectedDate] = React.useState(() => {
    const todayInWeek = weekDays.find(d => format(d, 'yyyy-MM-dd') === today)
    return todayInWeek ?? weekDays[0]
  })

  React.useEffect(() => {
    const todayInWeek = weekDays.find(d => format(d, 'yyyy-MM-dd') === today)
    setSelectedDate(todayInWeek ?? weekDays[0])
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const myShifts = shifts.filter(s => s.staff_id === session?.staffId)
  const selectedShift = myShifts.find(s => s.shift_date === selectedDateStr)
  const upcomingShifts = myShifts.filter(s => s.shift_date > today).sort((a, b) => a.shift_date.localeCompare(b.shift_date))
  const me = staff.find(s => s.id === session?.staffId)
  const hourlyRate = me?.hourly_rate
  const dayShifts = shifts.filter(s => s.shift_date === selectedDateStr)
  const myShiftDates = new Set(myShifts.map(s => s.shift_date))
  const otherShiftDates = new Set(shifts.filter(s => s.staff_id !== session?.staffId).map(s => s.shift_date))
  const weekNum = format(weekStart, 'w')
  const weekRange = `${format(weekDays[0], 'd MMM')} – ${format(weekDays[6], 'd MMM')}`
  const upcomingHours = upcomingShifts.reduce((sum, s) => sum + shiftDurationHours(s.start_time, s.end_time), 0)
  const upcomingPay = hourlyRate ? upcomingShifts.reduce((sum, s) => sum + paidShiftHours(s.start_time, s.end_time) * hourlyRate, 0) : null
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const mySwaps = swaps.filter(s => s.requester_id === session?.staffId)
  const myPending = mySwaps.filter(s => s.status === 'pending')

  /* ── edit-hours state ── */
  const { venueId }   = useVenue()
  const ehToast       = useToast()
  const { sessions: clockSessions, reload: reloadClockSessions } = useClockSessions(session?.staffId ?? '')
  const [fixCtx, setFixCtx]     = React.useState(null)
  const [reqs, setReqs]         = React.useState({})
  const [payrollLocks, setPayrollLocks] = React.useState([])

  // Load payroll locks so staff can't submit corrections for locked periods
  React.useEffect(() => {
    if (!venueId) return
    supabase.from('app_settings').select('value').eq('venue_id', venueId).eq('key', 'payroll_locks').maybeSingle()
      .then(({ data }) => {
        try { setPayrollLocks(JSON.parse(data?.value ?? '[]')) } catch { setPayrollLocks([]) }
      })
  }, [venueId])

  const isDateLocked = React.useCallback((date) => {
    const d = format(date, 'yyyy-MM-dd')
    return payrollLocks.some(l => d >= l.from && d <= l.to)
  }, [payrollLocks])

  // Fetch pending/denied clock_edit_requests for this staff member
  React.useEffect(() => {
    if (!session?.staffId || !venueId) return
    supabase
      .from('clock_edit_requests')
      .select('clock_in_id, status, requested_clock_in, requested_clock_out, break_minutes')
      .eq('staff_id', session.staffId)
      .eq('venue_id', venueId)
      .in('status', ['pending', 'denied', 'approved'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const map = {}
        for (const r of data) {
          if (map[r.clock_in_id]) continue // most recent wins
          const rIn  = r.requested_clock_in  ? new Date(r.requested_clock_in)  : null
          const rOut = r.requested_clock_out ? new Date(r.requested_clock_out) : null
          map[r.clock_in_id] = {
            status:   r.status,
            start:    rIn  ? fmtHM(rIn)  : null,
            end:      rOut ? fmtHM(rOut) : null,
            newMins:  (rIn && rOut) ? ehWorkedMins(fmtHM(rIn), fmtHM(rOut), r.break_minutes ?? 0) : 0,
          }
        }
        setReqs(map)
      })
  }, [session?.staffId, venueId]) // eslint-disable-line

  // Filter clock sessions to the current week
  const weekDateStrs = weekDays.map(d => format(d, 'yyyy-MM-dd'))
  const weekClockSessions = React.useMemo(() => {
    return clockSessions.filter(s => s.clockOutAt && weekDateStrs.includes(format(s.date, 'yyyy-MM-dd')))
  }, [clockSessions, weekStart]) // eslint-disable-line

  // Build worked rows with display data
  const workedRows = React.useMemo(() => {
    return weekClockSessions.map(sess => {
      const dateStr = format(sess.date, 'yyyy-MM-dd')
      const shift   = myShifts.find(s => s.shift_date === dateStr)
      const sStr    = fmtHM(sess.clockInAt)
      const eStr    = fmtHM(sess.clockOutAt)
      return {
        session:    sess,
        dateStr,
        startStr:   sStr,
        endStr:     eStr,
        workedMins: ehWorkedMins(sStr, eStr, sess.breakMinutes ?? 0),
        role:       shift?.role_label ?? '',
        dow:        format(sess.date, 'EEE').toUpperCase(),
        dateNum:    format(sess.date, 'd'),
      }
    }).sort((a, b) => a.session.date - b.session.date) // chronological
  }, [weekClockSessions, myShifts])

  // The clock session for the selected day (if any)
  const selectedDaySession = React.useMemo(() => {
    return workedRows.find(r => r.dateStr === selectedDateStr)
  }, [workedRows, selectedDateStr])

  // Submit a correction request
  const submitFix = React.useCallback(async (clockSess, data) => {
    if (isDateLocked(clockSess.date)) {
      ehToast('This period has been locked for payroll — contact your manager', 'error')
      return
    }
    const reqIn  = applyTimeToDate(clockSess.clockInAt,  data.start)
    const reqOut = applyTimeToDate(clockSess.clockOutAt ?? clockSess.clockInAt, data.end)
    const { error } = await supabase.rpc('submit_clock_edit_request', {
      p_venue_id:           venueId,
      p_staff_id:           session.staffId,
      p_clock_in_id:        clockSess.clockInId,
      p_clock_out_id:       clockSess.clockOutId,
      p_original_clock_in:  clockSess.clockInAt.toISOString(),
      p_original_clock_out: clockSess.clockOutAt?.toISOString() ?? null,
      p_requested_clock_in: reqIn.toISOString(),
      p_requested_clock_out: reqOut.toISOString(),
      p_break_minutes:      data.brk,
      p_reason:             data.note ? `${data.reason} — ${data.note}` : data.reason,
    })
    if (error) { ehToast(error.message, 'error'); return }
    await sendPush({
      venueId,
      notificationType: 'hour_edit_request',
      title: 'Hour edit request',
      body: `${me?.name ?? 'Staff'} requested a change to their hours on ${format(clockSess.date, 'EEE d MMM')}`,
      url: '/timesheet',
      roles: ['manager', 'owner'],
    })
    // Optimistic update
    setReqs(prev => ({
      ...prev,
      [clockSess.clockInId]: {
        status:  'pending',
        start:   data.start,
        end:     data.end,
        newMins: data.newMins,
      },
    }))
    ehToast('Sent to your manager for approval ✓')
    reloadClockSessions()
  }, [venueId, session, me, ehToast, reloadClockSessions]) // eslint-disable-line

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-baseline justify-between px-1">
        <span className="font-mono text-[10.5px] text-charcoal/50 tracking-[0.08em] uppercase">My Shifts</span>
        <span className="font-mono text-[10.5px] text-charcoal/50">Week {weekNum} · {weekRange}</span>
      </div>

      {/* Week strip */}
      <div className="flex items-center gap-1.5">
        <button onClick={prevWeek} className="w-8 h-[60px] flex items-center justify-center rounded-[9px] bg-white border border-charcoal/15 text-charcoal/40 hover:text-charcoal hover:border-charcoal/30 transition-colors shrink-0">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1L1 7l6 6"/></svg>
        </button>
        <div className="flex-1 grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isSel = dateStr === selectedDateStr
            const hasMyShift = myShiftDates.has(dateStr)
            const hasOtherShift = otherShiftDates.has(dateStr)
            const isT = dateStr === today
            return (
              <button key={dateStr} onClick={() => setSelectedDate(day)}
                className={`h-[60px] rounded-[9px] flex flex-col items-center justify-center gap-0.5 relative transition-colors ${isSel ? 'bg-charcoal border border-charcoal text-white' : 'bg-white border border-charcoal/15 text-charcoal hover:border-charcoal/30'}`}>
                <span className={`font-mono text-[9px] font-semibold tracking-[0.06em] ${isSel ? 'text-white/70' : 'text-charcoal/50'}`}>
                  {format(day, 'EEE').toUpperCase()}
                </span>
                <span className="font-mono text-[17px] font-semibold leading-none">{format(day, 'd')}</span>
                {(hasMyShift || hasOtherShift) && (
                  <span className={`absolute bottom-1.5 w-1 h-1 rounded-full ${hasMyShift ? (isSel ? 'bg-white' : 'bg-brand') : (isSel ? 'bg-white/40' : 'bg-charcoal/25')}`} />
                )}
                {isT && !isSel && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </button>
            )
          })}
        </div>
        <button onClick={nextWeek} className="w-8 h-[60px] flex items-center justify-center rounded-[9px] bg-white border border-charcoal/15 text-charcoal/40 hover:text-charcoal hover:border-charcoal/30 transition-colors shrink-0">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1l6 6-6 6"/></svg>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <>
          {/* Day heading */}
          <div className="flex items-baseline gap-2 px-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.022em]">{format(selectedDate, 'EEEE, d MMMM')}</h1>
            {selectedDateStr === today && (
              <span className="font-mono text-[11px] text-accent font-semibold tracking-[0.06em]">TODAY</span>
            )}
          </div>

          {/* Day at a glance — always at top */}
          {dayShifts.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between px-1 mb-2">
                <span className="font-mono text-[10.5px] text-charcoal/50 tracking-[0.08em] uppercase font-semibold">Day at a glance</span>
                <span className="font-mono text-[11px] text-charcoal/50">{dayShifts.length} on shift</span>
              </div>
              <GanttChart shifts={dayShifts} staff={staff} currentStaffId={session?.staffId} nowMins={nowMins} showNow={selectedDateStr === today} />
            </div>
          )}

          {/* Per-day card — worked day OR scheduled shift OR empty */}
          {selectedDaySession ? (
            <DayWorkedCard
              session={selectedDaySession.session}
              role={selectedDaySession.role}
              req={reqs[selectedDaySession.session.clockInId]}
            />
          ) : selectedShift ? (
            <div className="rounded-2xl p-4 text-white" style={{ background: '#13362a' }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] text-white/55 tracking-[0.1em] uppercase">Your shift</span>
              </div>
              <div className="font-mono text-[30px] font-medium tracking-[-0.025em] tabular-nums mt-1.5">
                {selectedShift.start_time.slice(0, 5)} — {selectedShift.end_time.slice(0, 5)}
              </div>
              <div className="flex items-center gap-2.5 mt-1 text-white/70 text-sm">
                {selectedShift.role_label && <span>{selectedShift.role_label}</span>}
                <span className="text-white/30">·</span>
                <span className="font-mono">{durationLabel(selectedShift.start_time, selectedShift.end_time)}</span>
                {hourlyRate && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="font-mono">£{(paidShiftHours(selectedShift.start_time, selectedShift.end_time) * hourlyRate).toFixed(2)}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-charcoal/4 border border-dashed border-charcoal/20 px-5 py-5 text-center">
              <p className="text-sm text-charcoal/40">No shift scheduled on this day</p>
            </div>
          )}

          {/* This week · worked */}
          <WorkedSection
            rows={workedRows}
            reqs={reqs}
            hourlyRate={hourlyRate}
            onFix={(sess, role) => setFixCtx({ session: sess, role })}
            isDateLocked={isDateLocked}
          />

          {/* Upcoming shifts */}
          {upcomingShifts.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between px-1 mb-2">
                <span className="font-mono text-[10.5px] text-charcoal/50 tracking-[0.08em] uppercase font-semibold">Your upcoming shifts</span>
                <span className="font-mono text-[11px] text-charcoal/50">{upcomingShifts.length} · next 2 wks</span>
              </div>
              <div className="bg-white border border-charcoal/10 rounded-2xl overflow-hidden">
                {upcomingShifts.map((shift, i) => (
                  <div key={shift.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-charcoal/8' : ''}`}>
                    <div className="w-11 h-12 rounded-[9px] bg-charcoal/4 border border-charcoal/10 shrink-0 flex flex-col items-center justify-center gap-0.5">
                      <span className="font-mono text-[9px] text-charcoal/50 tracking-[0.06em] font-semibold">{format(parseISO(shift.shift_date), 'EEE').toUpperCase()}</span>
                      <span className="font-mono text-[17px] font-semibold text-charcoal leading-none">{format(parseISO(shift.shift_date), 'd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[13.5px] font-semibold tabular-nums text-charcoal">
                        {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                      </div>
                      <div className="text-[11.5px] text-charcoal/50 mt-0.5 flex items-center gap-1.5">
                        <span>{durationLabel(shift.start_time, shift.end_time)}</span>
                        {shift.role_label && <><span className="text-charcoal/30">·</span><span>{shift.role_label}</span></>}
                        <span className="text-charcoal/30">·</span>
                        <span>{shift.shift_date === today ? 'Today' : format(parseISO(shift.shift_date), 'EEE d MMM')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const staffMember = staff.find(s => s.id === shift.staff_id)
                        setSwapModal({ staffMember, date: parseISO(shift.shift_date), shift })
                        setSwapForm({ targetStaffId: '', message: '' })
                      }}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/60 text-[11.5px] font-semibold hover:border-charcoal/30 hover:text-charcoal transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>
                      Swap
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 border-t border-charcoal/8 bg-charcoal/3">
                  <div className="flex gap-4">
                    <div>
                      <div className="font-mono text-[9.5px] text-charcoal/50 tracking-[0.06em] uppercase">Shifts</div>
                      <div className="font-mono text-[14px] font-semibold mt-0.5">{upcomingShifts.length}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9.5px] text-charcoal/50 tracking-[0.06em] uppercase">Hours</div>
                      <div className="font-mono text-[14px] font-semibold mt-0.5">{Math.round(upcomingHours)}h</div>
                    </div>
                    {upcomingPay != null && (
                      <div>
                        <div className="font-mono text-[9.5px] text-charcoal/50 tracking-[0.06em] uppercase">Est. Pay</div>
                        <div className="font-mono text-[14px] font-semibold mt-0.5 text-success">£{upcomingPay.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-charcoal/10 rounded-2xl px-5 py-6 text-center">
              <p className="text-sm text-charcoal/40">No upcoming shifts in the next 2 weeks</p>
            </div>
          )}

          {/* My swap requests */}
          {mySwaps.length > 0 && (
            <div className={`rounded-2xl border px-5 py-4 ${myPending.length > 0 ? 'bg-warning/5 border-warning/20' : 'bg-charcoal/4 border-charcoal/10'}`}>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">My Swap Requests</p>
              <div className="flex flex-col gap-2">
                {mySwaps.slice(0, 3).map((swap) => (
                  <div key={swap.id} className="flex items-center justify-between text-sm">
                    <span className="text-charcoal/70">
                      Swap with <span className="font-medium text-charcoal">{swap.target_staff_name}</span>
                      {swap.shift && <span className="text-xs text-charcoal/40 ml-1">({swap.shift.shift_date})</span>}
                    </span>
                    <span className={`text-[11px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium ${swap.status === 'pending' ? 'bg-warning/15 text-warning' : swap.status === 'approved' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {swap.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <RotaSwapRequestModal
        swapModal={swapModal}
        setSwapModal={setSwapModal}
        swapForm={swapForm}
        setSwapForm={setSwapForm}
        swapSaving={swapSaving}
        submitSwapRequest={submitSwapRequest}
        swapCandidates={swapCandidates}
      />

      {/* Fix-hours sheet */}
      <FixHoursSheet
        ctx={fixCtx}
        onClose={() => setFixCtx(null)}
        onSubmit={submitFix}
      />
    </div>
  )
}

export default function RotaPage() {
  const toast = useToast()
  const { venueId, venueName } = useVenue()
  const { session, isManager } = useSession()
  const [searchParams] = useSearchParams()
  const personalView = searchParams.get('personal') === '1'

  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [numWeeks, setNumWeeks]   = useState(1)
  const { shifts, loading, reload } = useShifts(weekStart, (isManager && !personalView) ? numWeeks : 2)
  const { staff, loading: staffLoading } = useStaffList()
  const crossShifts = useCrossVenueShifts(staff, weekStart, numWeeks, venueId)
  const { swaps, loading: swapsLoading, reload: reloadSwaps, pendingCount } = useShiftSwaps()
  const { unavailability, toggleAvailability } = useAvailability(weekStart, numWeeks)
  const { customRoles, closedDays, breakDurationMins } = useAppSettings()
  const { roles: venueRoles } = useVenueRoles()

  // ── Staff roles map (for auto-fill) ──
  const [staffRoles, setStaffRoles] = useState({})
  useEffect(() => {
    if (!venueId) return
    const crossVenueIds = staff.filter(s => s._crossVenue).map(s => s.id)
    loadAllStaffRolesForVenue(venueId, crossVenueIds).then(setStaffRoles)
  }, [venueId, staff])

  // ── Venue closures ──
  const [closures, setClosures] = useState([])
  const loadClosures = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('venue_closures')
      .select('id, start_date, end_date')
      .eq('venue_id', venueId)
    setClosures(data ?? [])
  }, [venueId])
  useEffect(() => { loadClosures() }, [loadClosures])

  const closedDates = React.useMemo(() => {
    const set = new Set()
    for (const c of closures) {
      try {
        const days = eachDayOfInterval({ start: parseISO(c.start_date), end: parseISO(c.end_date) })
        days.forEach(d => set.add(format(d, 'yyyy-MM-dd')))
      } catch { /* skip invalid ranges */ }
    }
    return set
  }, [closures])

  // ── Closure mode ──
  const [closureMode, setClosureMode]       = useState(false)
  const [pendingClosed, setPendingClosed]   = useState(null)
  const [savingClosures, setSavingClosures] = useState(false)

  const enterClosureMode = () => {
    setPendingClosed(new Set(closedDates))
    setClosureMode(true)
  }

  const cancelClosureMode = () => {
    setPendingClosed(null)
    setClosureMode(false)
  }

  const togglePendingClosure = (dateStr) => {
    setPendingClosed(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  const saveClosures = async () => {
    if (!pendingClosed || savingClosures) return
    setSavingClosures(true)
    const toAdd    = [...pendingClosed].filter(d => !closedDates.has(d))
    const toDelete = [...closedDates].filter(d => !pendingClosed.has(d))
    for (const dateStr of toDelete) {
      const existing = closures.find(c => c.start_date === dateStr && c.end_date === dateStr)
      if (existing) await supabase.from('venue_closures').delete().eq('id', existing.id)
    }
    if (toAdd.length > 0) {
      await supabase.from('venue_closures').insert(
        toAdd.map(dateStr => ({ venue_id: venueId, start_date: dateStr, end_date: dateStr }))
      )
    }
    await loadClosures()
    setSavingClosures(false)
    setPendingClosed(null)
    setClosureMode(false)
    toast(toAdd.length + toDelete.length > 0 ? 'Closed days saved ✓' : 'No changes made')
  }

  const effectiveClosedDates = closureMode && pendingClosed != null ? pendingClosed : closedDates

  const [showBuilder, setShowBuilder] = useState(false)
  const [showAI, setShowAI]           = useState(false)
  const [showConfig, setShowConfig]   = useState(false)

  // Shift modal state
  const [modal, setModal]         = useState(null)
  const [editShift, setEditShift] = useState(null)
  const [form, setForm]           = useState({ staffId: '', startTime: '09:00', endTime: '17:00', roleLabel: 'Chef' })
  const [saving, setSaving]       = useState(false)

  const { templates: dutyTemplates } = useDutyTemplates()
  const [assignDuty, setAssignDuty]         = useState(false)
  const [selectedDutyId, setSelectedDutyId] = useState(null)
  const [emailing, setEmailing] = useState(false)
  const [sharing, setSharing]   = useState(false)

  // Swap state
  const [swapModal, setSwapModal]   = useState(null)
  const [swapForm, setSwapForm]     = useState({ targetStaffId: '', message: '' })
  const [swapSaving, setSwapSaving] = useState(false)
  const [showSwaps, setShowSwaps]   = useState(false)
  const [rejectNote, setRejectNote] = useState({})
  const [resolving, setResolving]   = useState(null)

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -numWeeks))
  const nextWeek = () => setWeekStart((w) => addWeeks(w, numWeeks))

  const openCell = (staffMember, date, dayShifts) => {
    if (!isManager) return
    if (closureMode) return
    const dateStr = format(date, 'yyyy-MM-dd')
    if (effectiveClosedDates.has(dateStr)) return
    setModal({ staffMember, date, dayShifts })
    const lastRole = localStorage.getItem(`mise_last_role_${staffMember.id}`) || venueRoles[0]?.name || ''
    setForm({ staffId: staffMember.id, startTime: '09:00', endTime: '17:00', roleLabel: lastRole })
    setEditShift(null)
    setAssignDuty(false)
    setSelectedDutyId(null)
  }

  const openStaffCell = (staffMember, date, dayShifts) => {
    if (isManager) return openCell(staffMember, date, dayShifts)
    if (staffMember.id !== session?.staffId) return
    if (dayShifts.length === 0) return
    setSwapModal({ staffMember, date, shift: dayShifts[0] })
    setSwapForm({ targetStaffId: '', message: '' })
  }

  const openEdit = async (sh) => {
    setEditShift(sh)
    setForm({
      staffId:   sh.staff_id,
      startTime: sh.start_time?.slice(0, 5) ?? '09:00',
      endTime:   sh.end_time?.slice(0, 5) ?? '17:00',
      roleLabel: sh.role_label,
    })
    const { data } = await supabase
      .from('duty_assignments')
      .select('duty_template_id')
      .eq('shift_id', sh.id)
      .maybeSingle()
    if (data) {
      setAssignDuty(true)
      setSelectedDutyId(data.duty_template_id)
    } else {
      setAssignDuty(false)
      setSelectedDutyId(null)
    }
  }

  const applyPreset = (preset) => {
    setForm((f) => ({ ...f, startTime: preset.start, endTime: preset.end }))
  }

  const saveShift = async () => {
    setSaving(true)
    const payload = {
      staff_id:   form.staffId,
      shift_date: format(modal.date, 'yyyy-MM-dd'),
      week_start: format(getWeekStart(modal.date), 'yyyy-MM-dd'),
      start_time: form.startTime,
      end_time:   form.endTime,
      role_label: form.roleLabel,
      venue_id:   venueId,
    }
    let shiftId = editShift?.id
    if (editShift) {
      const { error } = await supabase.from('shifts').update(payload).eq('id', editShift.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('shifts').insert(payload).select('id').single()
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      shiftId = data.id
    }
    if (shiftId) {
      await supabase.from('duty_assignments').delete().eq('shift_id', shiftId)
      if (assignDuty && selectedDutyId) {
        await supabase.from('duty_assignments').insert({
          venue_id:             venueId,
          shift_id:             shiftId,
          duty_template_id:     selectedDutyId,
          assigned_by_staff_id: session?.staffId ?? null,
        })
      }
    }
    setSaving(false)
    if (form.roleLabel) localStorage.setItem(`mise_last_role_${form.staffId}`, form.roleLabel)
    toast(editShift ? 'Shift updated' : 'Shift added')
    setModal(null)
    reload()
  }

  const deleteShift = async (shiftId) => {
    const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
    if (error) { toast(error.message, 'error'); return }
    toast('Shift removed')
    setModal(null)
    reload()
  }

  const emailRota = async () => {
    setEmailing(true)
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const { error: saveErr } = await supabase.from('app_settings').upsert({
      venue_id: venueId,
      key: `rota_published_${weekStartStr}`,
      value: new Date().toISOString(),
    }, { onConflict: 'venue_id,key' })
    if (saveErr) { toast('Failed to publish: ' + saveErr.message, 'error'); setEmailing(false); return }
    const staffIds = [...new Set(shifts.map(s => s.staff_id).filter(Boolean))]
    if (staffIds.length) {
      sendPush({
        venueId,
        notificationType: 'rota_published',
        title: 'Rota Published',
        body:  `Your rota for the week of ${weekStartStr} is now available.`,
        url:   '/rota',
        staffIds,
      }).catch(() => {})
    }
    setEmailing(false)
    toast('Rota published ✓')
  }

  const submitSwapRequest = async () => {
    if (!swapForm.targetStaffId) { toast('Please select a colleague to swap with', 'error'); return }
    setSwapSaving(true)
    const targetStaff = staff.find((s) => s.id === swapForm.targetStaffId)
    const { error } = await supabase.rpc('create_swap_request', {
      p_token:           session?.token,
      p_shift_id:        swapModal.shift.id,
      p_target_staff_id: swapForm.targetStaffId,
      p_message:         swapForm.message.trim() || null,
    })
    setSwapSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Swap request sent to ${targetStaff?.name ?? 'colleague'} ✓`)
    setSwapModal(null)
    reloadSwaps()
    sendPush({
      venueId,
      notificationType: 'shift_swap_request',
      title: 'Shift Swap Request',
      body:  `${session?.staffName ?? 'A staff member'} has requested a shift swap`,
      url:   '/rota',
      roles: ['manager', 'owner'],
    }).catch(() => {})
  }

  const approveSwap = async (swap) => {
    setResolving(swap.id)
    const { error: shiftErr } = await supabase
      .from('shifts')
      .update({ staff_id: swap.target_staff_id })
      .eq('id', swap.shift_id)
    if (shiftErr) { toast(shiftErr.message, 'error'); setResolving(null); return }
    const { error } = await supabase
      .from('shift_swaps')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', swap.id)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap approved — shift reassigned ✓')
    const staffIds = [swap.requester_id, swap.target_staff_id].filter(Boolean)
    if (staffIds.length) {
      sendPush({
        venueId,
        notificationType: 'shift_swap_decision',
        title: 'Shift Swap Approved',
        body:  'Your shift swap request has been approved. Check the rota for updates.',
        url:   '/rota',
        staffIds,
      }).catch(() => {})
    }
    reloadSwaps()
    reload()
  }

  const rejectSwap = async (swap) => {
    setResolving(swap.id)
    const { error } = await supabase
      .from('shift_swaps')
      .update({
        status:       'rejected',
        manager_note: rejectNote[swap.id]?.trim() || null,
        resolved_at:  new Date().toISOString(),
      })
      .eq('id', swap.id)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap request rejected')
    if (swap.requester_id) {
      sendPush({
        venueId,
        notificationType: 'shift_swap_decision',
        title: 'Shift Swap Rejected',
        body:  `Your shift swap request was not approved.${rejectNote[swap.id]?.trim() ? ' Note: ' + rejectNote[swap.id].trim() : ''}`,
        url:   '/rota',
        staffIds: [swap.requester_id],
      }).catch(() => {})
    }
    reloadSwaps()
  }

  const shareViaWhatsApp = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const days = getWeekDays(weekStart)
      const currentShifts = shifts.filter((sh) => sh.week_start === format(weekStart, 'yyyy-MM-dd'))
      const result = await shareRotaImage({ venueName, weekStart, days, shifts: currentShifts, staff, closedDays, closedDates })
      if (result === 'downloaded') toast('Rota image saved — share it on WhatsApp from your downloads')
    } catch {
      toast('Could not export rota image', 'error')
    } finally {
      setSharing(false)
    }
  }

  const [copyingWeek, setCopyingWeek] = useState(false)

  const copyWeek = async () => {
    if (copyingWeek) return
    setCopyingWeek(true)
    const targetWeekStr = format(weekStart, 'yyyy-MM-dd')
    const sourceWeekStart = addWeeks(weekStart, -1)
    const sourceWeekStr   = format(sourceWeekStart, 'yyyy-MM-dd')

    // Fetch shifts from previous week
    const { data: sourceShifts, error: fetchErr } = await supabase
      .from('shifts')
      .select('staff_id, shift_date, start_time, end_time, role_label')
      .eq('venue_id', venueId)
      .eq('week_start', sourceWeekStr)
    if (fetchErr) { toast(fetchErr.message, 'error'); setCopyingWeek(false); return }
    if (!sourceShifts?.length) { toast('No shifts in previous week to copy', 'error'); setCopyingWeek(false); return }

    const closedDateSet = closedDates

    // Map each shift forward by 7 days, skipping closed dates
    const newShifts = sourceShifts
      .map(sh => {
        const newDate = format(addWeeks(parseISO(sh.shift_date), 1), 'yyyy-MM-dd')
        if (closedDateSet.has(newDate)) return null
        return {
          venue_id:   venueId,
          staff_id:   sh.staff_id,
          shift_date: newDate,
          week_start: targetWeekStr,
          start_time: sh.start_time,
          end_time:   sh.end_time,
          role_label: sh.role_label,
        }
      })
      .filter(Boolean)

    if (!newShifts.length) { toast('All shifts land on closed days — nothing to copy', 'error'); setCopyingWeek(false); return }

    const { error: insertErr } = await supabase.from('shifts').insert(newShifts)
    setCopyingWeek(false)
    if (insertErr) { toast(insertErr.message, 'error'); return }
    toast(`${newShifts.length} shift${newShifts.length !== 1 ? 's' : ''} copied from previous week ✓`)
    reload()
  }

  const batchSaveShifts = async (newShifts, isRebuild) => {
    if (isRebuild) {
      const wsStr = format(weekStart, 'yyyy-MM-dd')
      const { error: delErr } = await supabase
        .from('shifts')
        .delete()
        .eq('venue_id', venueId)
        .eq('week_start', wsStr)
      if (delErr) { toast(delErr.message, 'error'); return }
    }
    const { error } = await supabase.from('shifts').insert(newShifts)
    if (error) { toast(error.message, 'error'); return }
    toast(`${newShifts.length} shifts created ✓`)
    reload()
  }

  const pendingSwaps  = swaps.filter((s) => s.status === 'pending')
  const resolvedSwaps = swaps.filter((s) => s.status !== 'pending')
  const swapCandidates = staff.filter((s) => s.id !== session?.staffId)

  if (!isManager || personalView) {
    return (
      <StaffRotaView
        shifts={shifts}
        staff={staff}
        loading={loading || staffLoading}
        weekStart={weekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        session={session}
        swapModal={swapModal}
        setSwapModal={setSwapModal}
        swapForm={swapForm}
        setSwapForm={setSwapForm}
        swapSaving={swapSaving}
        submitSwapRequest={submitSwapRequest}
        swapCandidates={swapCandidates}
        swaps={swaps}
      />
    )
  }

  // Mobile: render the purpose-built mobile grid
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return <RotaMobileGrid />
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="hidden lg:block">
        <RotaToolbar
          isManager={isManager}
          closureMode={closureMode}
          showConfig={showConfig}
          setShowConfig={setShowConfig}
          setShowAI={setShowAI}
          emailRota={emailRota}
          emailing={emailing}
          shiftsCount={shifts.length}
          shareViaWhatsApp={shareViaWhatsApp}
          sharing={sharing}
          enterClosureMode={enterClosureMode}
          cancelClosureMode={cancelClosureMode}
          saveClosures={saveClosures}
          savingClosures={savingClosures}
          copyWeek={copyWeek}
          copyingWeek={copyingWeek}
        />
      </div>

      {/* ── Closure mode banner ── */}
      {closureMode && (
        <div className="rounded-2xl border border-danger/25 bg-danger/5 px-5 py-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-danger shrink-0 mt-0.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div>
            <p className="text-sm font-semibold text-danger">Marking closed days</p>
            <p className="text-xs text-danger/70 mt-0.5">
              Tap any number of days to mark them closed — tap again to unmark.
              No shifts can be added on closed days. Hit <strong>Save</strong> when done, or <strong>Cancel</strong> to discard changes.
            </p>
          </div>
        </div>
      )}

      {/* Availability legend */}
      {isManager && (
        <div className="hidden lg:flex items-center gap-4 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-success/30 border border-success/30" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-charcoal/15 border border-charcoal/20" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-danger/20 border border-danger/25" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Time Off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-charcoal/8 border border-charcoal/15" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Closed</span>
          </div>
        </div>
      )}

      {/* ── Manager: pending swap requests banner ── */}
      {isManager && pendingCount > 0 && (
        <button
          onClick={() => setShowSwaps((v) => !v)}
          className="w-full text-left rounded-2xl border border-warning/30 bg-warning/8 px-5 py-4 flex items-center justify-between hover:bg-warning/12 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-warning shrink-0"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            <div>
              <p className="text-sm font-semibold text-warning">
                {pendingCount} shift swap request{pendingCount !== 1 ? 's' : ''} pending
              </p>
              <p className="text-xs text-warning/70 mt-0.5">Tap to review and approve or reject</p>
            </div>
          </div>
          <span className="text-warning/60 text-lg">{showSwaps ? '▲' : '▼'}</span>
        </button>
      )}

      {/* ── Manager: swap panel ── */}
      {isManager && (
        <RotaSwapPanel
          showSwaps={showSwaps}
          setShowSwaps={setShowSwaps}
          swapsLoading={swapsLoading}
          swaps={swaps}
          pendingSwaps={pendingSwaps}
          resolvedSwaps={resolvedSwaps}
          rejectNote={rejectNote}
          setRejectNote={setRejectNote}
          resolving={resolving}
          approveSwap={approveSwap}
          rejectSwap={rejectSwap}
        />
      )}


      {/* ── Week count selector ── */}
      {isManager && (
        <div className="hidden lg:flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">View</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setNumWeeks(n)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                numWeeks === n
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30 hover:text-charcoal',
              ].join(' ')}
            >
              {n} {n === 1 ? 'week' : 'weeks'}
            </button>
          ))}
        </div>
      )}

      {/* ── Rota grid(s) ── */}
      {Array.from({ length: numWeeks }, (_, wi) => {
        const thisWeekStart = addWeeks(weekStart, wi)
        const thisWeekShifts = shifts.filter(
          (sh) => sh.week_start === format(thisWeekStart, 'yyyy-MM-dd')
        )
        return (
          <div key={format(thisWeekStart, 'yyyy-MM-dd')} className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
            {wi === 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8">
                <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">‹</button>
                <span className="text-sm font-medium text-charcoal">
                  {format(weekStart, 'd MMM')} – {format(addWeeks(weekStart, numWeeks), 'd MMM yyyy')}
                </span>
                <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">›</button>
              </div>
            )}
            {numWeeks > 1 && (
              <div className="px-5 py-2 bg-charcoal/4 border-b border-charcoal/8">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/50 font-medium">
                  Week {wi + 1} — {format(thisWeekStart, 'd MMM')} – {format(addWeeks(thisWeekStart, 1), 'd MMM')}
                </p>
              </div>
            )}
            {loading || staffLoading ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : (
              <RotaWeekView
                weekStart={thisWeekStart}
                shifts={thisWeekShifts}
                staff={staff}
                onCellClick={openStaffCell}
                onToggleAvailability={(staffId, date) => toggleAvailability(staffId, date)}
                currentStaffId={session?.staffId ?? null}
                isManager={isManager}
                unavailability={unavailability}
                closedDays={closedDays}
                closedDates={effectiveClosedDates}
                closureMode={closureMode}
                onToggleClosure={togglePendingClosure}
                breakDurationMins={breakDurationMins}
                crossShifts={crossShifts}
              />
            )}
          </div>
        )
      })}

      {/* ── Manager: shift modal ── */}
      {isManager && (
        <RotaShiftModal
          modal={modal}
          setModal={setModal}
          editShift={editShift}
          setEditShift={setEditShift}
          form={form}
          setForm={setForm}
          saving={saving}
          saveShift={saveShift}
          deleteShift={deleteShift}
          openEdit={openEdit}
          applyPreset={applyPreset}
          venueRoles={venueRoles}
          staff={staff}
          breakDurationMins={breakDurationMins}
          dutyTemplates={dutyTemplates}
          assignDuty={assignDuty}
          setAssignDuty={setAssignDuty}
          selectedDutyId={selectedDutyId}
          setSelectedDutyId={setSelectedDutyId}
        />
      )}

      {/* ── Manager: rota builder modal ── */}
      {isManager && (
        <RotaBuilderModal
          open={showBuilder}
          onClose={() => setShowBuilder(false)}
          weekStart={weekStart}
          days={getWeekDays(weekStart)}
          staff={staff}
          shifts={shifts.filter(sh => sh.week_start === format(weekStart, 'yyyy-MM-dd'))}
          unavailability={unavailability}
          onSave={batchSaveShifts}
          customRoles={customRoles}
          closedDays={closedDays}
          breakDurationMins={breakDurationMins}
        />
      )}

      {/* ── AI auto-fill modal ── */}
      <RotaAIModal
        open={showAI}
        onClose={() => setShowAI(false)}
        weekStart={weekStart}
        onSave={batchSaveShifts}
        staff={staff}
        staffRoles={staffRoles}
        unavailability={unavailability}
        closedDays={closedDays}
        crossVenueShifts={crossShifts}
      />

      {/* ── Rota config modal ── */}
      <RotaConfigModal
        open={showConfig}
        onClose={() => setShowConfig(false)}
        closedDayIndices={closedDays}
      />

    </div>
  )
}
