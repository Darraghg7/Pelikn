import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  ehWorkedMins, ehDurLabel, ehSignedLabel, fmtHM, timeDiffMins,
} from './rotaTimeHelpers'

const EDIT_REASONS  = ['Forgot to clock out', 'Clocked in early', 'Wrong times', 'Other']

/* scroll-snap wheel picker */
const WHEEL_IH = 36, WHEEL_VIS = 5
const WHEEL_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2,'0'))
const WHEEL_MINS  = Array.from({ length: 60 }, (_, i) => String(i).padStart(2,'0'))

function EHWheel({ values, value, onChange }) {
  const ref   = React.useRef(null)
  const timer = React.useRef(null)
  const idx   = Math.max(0, values.indexOf(value))
  React.useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = idx * WHEEL_IH }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
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

/* Fix-hours bottom sheet */
export default function FixHoursSheet({ ctx, onClose, onSubmit }) {
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
            <div className="text-[12px] text-charcoal/50 dark:text-white/40 mt-0.5">{format(session.date, 'EEEE, d MMMM')}{role ? ` · ${role}` : ''}</div>
          </div>
          <span className="font-mono text-[9.5px] font-bold text-warning bg-warning/10 px-2.5 py-1 rounded-full tracking-[0.05em] uppercase">Recorded</span>
        </div>

        {/* recorded reference strip */}
        <div className="mt-3 flex items-center justify-between bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[11px] px-3 py-2.5">
          <span className="text-[11.5px] text-charcoal/50 dark:text-white/40">On the clock</span>
          <span className="font-mono text-[12.5px] font-semibold tabular-nums text-charcoal/70 dark:text-white/60">
            {origStart}–{origEnd} · {ehDurLabel(recMins)}
          </span>
        </div>

        {/* start/end toggle */}
        <div className="flex gap-2 mt-3.5 bg-charcoal/8 dark:bg-white/8 p-1 rounded-xl">
          {[['start','Clock in', start], ['end','Clock out', end]].map(([k, label, val]) => {
            const on = edge === k
            return (
              <button key={k} onClick={() => setEdge(k)} className="flex-1 rounded-[9px] py-2 transition-all"
                style={{ background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 3px rgba(9,18,13,0.1)' : 'none', border:'none', cursor:'pointer' }}>
                <div className="font-mono text-[9px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.06em] font-semibold">{label}</div>
                <div className="font-mono text-[17px] font-semibold tabular-nums mt-0.5" style={{ color: on ? '#13362a' : '#76817b' }}>{val}</div>
              </button>
            )
          })}
        </div>

        {/* scroll wheels — shift times */}
        {(edge === 'start' || edge === 'end') && (
          <div className="flex items-center justify-center gap-1 mt-2.5">
            <EHWheel values={WHEEL_HOURS} value={ch} onChange={(h) => setCur(h, cm)} />
            <span className="font-mono text-[21px] font-semibold text-charcoal/40 dark:text-white/35 pb-0.5">:</span>
            <EHWheel values={WHEEL_MINS} value={cm} onChange={(m) => setCur(ch, m)} />
          </div>
        )}

        {/* break section */}
        <div className="mt-3">
          <div className="flex items-center justify-between px-0.5 pb-2">
            <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.06em] font-semibold">Unpaid break</div>
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
              <div className="flex gap-2 bg-charcoal/8 dark:bg-white/8 p-1 rounded-xl">
                {[['brkStart', 'Break start', brkStart], ['brkEnd', 'Break end', brkEnd]].map(([k, label, val]) => {
                  const on = edge === k
                  return (
                    <button key={k} onClick={() => setEdge(k)} className="flex-1 rounded-[9px] py-2 transition-all"
                      style={{ background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 3px rgba(9,18,13,0.1)' : 'none', border: 'none', cursor: 'pointer' }}>
                      <div className="font-mono text-[9px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.06em] font-semibold">{label}</div>
                      <div className="font-mono text-[17px] font-semibold tabular-nums mt-0.5" style={{ color: on ? '#13362a' : '#76817b' }}>{val || '--:--'}</div>
                    </button>
                  )
                })}
              </div>
              {(edge === 'brkStart' || edge === 'brkEnd') && (
                <div className="flex items-center justify-center gap-1 mt-2.5">
                  <EHWheel values={WHEEL_HOURS} value={ch} onChange={(h) => setCur(h, cm)} />
                  <span className="font-mono text-[21px] font-semibold text-charcoal/40 dark:text-white/35 pb-0.5">:</span>
                  <EHWheel values={WHEEL_MINS} value={cm} onChange={(m) => setCur(ch, m)} />
                </div>
              )}
              {brk > 0 && (
                <div className="mt-1.5 text-center font-mono text-[11.5px] text-charcoal/50 dark:text-white/40">{ehDurLabel(brk)} break</div>
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
            <span className="font-mono text-[15px] font-bold tabular-nums text-charcoal dark:text-white">{start}–{end}</span>
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
            <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 uppercase tracking-[0.06em] font-semibold px-0.5 pb-1.5">Reason for change</div>
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
              className="w-full mt-2.5 px-3 py-2.5 rounded-[10px] border border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark text-[13px] text-charcoal dark:text-white outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20 focus:border-charcoal/20 dark:focus:border-white/20"
            />
          </div>
        )}

        {/* approval info */}
        <div className="mt-3 flex gap-2 items-start px-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76817b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span className="text-[11.5px] text-charcoal/50 dark:text-white/40 leading-snug">
            Your manager reviews this before it changes your pay. Recorded hours stay until approved.
          </span>
        </div>

        {/* actions */}
        <div className="flex gap-2 mt-3.5">
          <button onClick={onClose} className="w-24 h-12 rounded-xl border border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark text-[14px] font-semibold text-charcoal/70 dark:text-white/60" style={{ cursor:'pointer' }}>
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
              <p className="text-[13.5px] text-charcoal/50 dark:text-white/40 leading-relaxed mt-2 mb-4">
                You're asking to change {format(session.date, 'EEEE')}'s hours from{' '}
                <strong className="text-charcoal/70 dark:text-white/60">{ehDurLabel(recMins)}</strong> to{' '}
                <strong className="text-charcoal/70 dark:text-white/60">{ehDurLabel(newMins)}</strong> ({ehSignedLabel(delta)}).
                This won't change your pay until it's approved.
              </p>
              <button onClick={doSubmit} disabled={submitting}
                className="w-full h-12 rounded-xl text-[14.5px] font-bold text-white mb-2"
                style={{ background:'#13362a', border:'none', cursor:'pointer' }}>
                {submitting ? 'Sending…' : 'Submit for approval'}
              </button>
              <button onClick={() => setConfirming(false)}
                className="w-full h-[42px] rounded-xl text-[13.5px] font-semibold text-charcoal/50 dark:text-white/40"
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
