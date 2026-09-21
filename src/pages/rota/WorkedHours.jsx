import React from 'react'
import { ehWorkedMins, ehDurLabel, fmtHM } from './rotaTimeHelpers'

/*
 * Worked-hours display for the staff rota: a per-day card and the weekly
 * summary section. EHStatusPill is shared by both and stays private here.
 */

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

/* per-day worked card (selected day = past with a clock session) */
export function DayWorkedCard({ session, role, req }) {
  const origStart = fmtHM(session.clockInAt)
  const origEnd   = session.clockOutAt ? fmtHM(session.clockOutAt) : '--:--'
  const recMins   = session.clockOutAt ? ehWorkedMins(origStart, origEnd, session.breakMinutes ?? 0) : 0
  const status    = req?.status
  const showReq   = status === 'pending' || status === 'approved'
  return (
    <div className="bg-white dark:bg-paperDark rounded-2xl p-4" style={{ border:'1px solid rgba(13,26,20,0.20)', boxShadow:'0 1px 3px rgba(13,26,20,0.05)' }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] text-charcoal/50 dark:text-white/40 tracking-[0.1em] uppercase">Hours worked</span>
        {status ? <EHStatusPill status={status} /> : (
          <span className="font-mono text-[9.5px] font-bold text-charcoal/40 dark:text-white/35 bg-charcoal/8 dark:bg-white/8 px-2 py-0.5 rounded-full tracking-[0.05em] uppercase">Recorded</span>
        )}
      </div>
      <div className="font-mono text-[30px] font-medium tracking-[-0.025em] tabular-nums mt-2"
        style={{ textDecoration: showReq ? 'line-through' : 'none', opacity: showReq ? 0.45 : 1 }}>
        {origStart} — {origEnd}
      </div>
      <div className="flex items-center gap-2.5 text-[13px] text-charcoal/50 dark:text-white/40 mt-1">
        <span className="font-mono">{ehDurLabel(recMins)}</span>
        <span className="text-charcoal/25 dark:text-white/25">·</span>
        <span>{session.breakMinutes ?? 0}m break</span>
        {role && <><span className="text-charcoal/25 dark:text-white/25">·</span><span>{role}</span></>}
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
export function WorkedSection({ rows, reqs, hourlyRate, onFix, isDateLocked }) {
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
        <span className="font-mono text-[10.5px] text-charcoal/50 dark:text-white/40 tracking-[0.08em] uppercase font-semibold">This week · worked</span>
        <span className="font-mono text-[11px] text-charcoal/50 dark:text-white/40">{rows.length} logged · so far</span>
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
              <div className="w-11 h-12 rounded-[9px] bg-charcoal/4 dark:bg-white/5 border border-charcoal/10 dark:border-white/10 shrink-0 flex flex-col items-center justify-center gap-0.5">
                <span className="font-mono text-[9px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] font-semibold">{r.dow}</span>
                <span className="font-mono text-[17px] font-semibold text-charcoal dark:text-white leading-none">{r.dateNum}</span>
              </div>
              {/* middle */}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13.5px] font-semibold tabular-nums text-charcoal dark:text-white"
                  style={{ textDecoration: showReq ? 'line-through' : 'none', opacity: showReq ? 0.5 : 1 }}>
                  {r.startStr}–{r.endStr}
                </div>
                <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono">{ehDurLabel(r.workedMins)}</span>
                  {r.role && <><span className="text-charcoal/25 dark:text-white/25">·</span><span>{r.role}</span></>}
                  {(r.session.breakMinutes ?? 0) > 0 && <><span className="text-charcoal/25 dark:text-white/25">·</span><span>{r.session.breakMinutes}m break</span></>}
                </div>
                {showReq && <div className="mt-1"><EHStatusPill status={status} /></div>}
              </div>
              {/* right */}
              {status === 'pending' ? (
                <span className="font-mono text-[12.5px] font-bold text-warning tabular-nums shrink-0">
                  {req.start}–{req.end}
                </span>
              ) : isDateLocked?.(r.session.date) ? (
                <span className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] border border-charcoal/10 dark:border-white/10 text-charcoal/30 dark:text-white/30 text-[11.5px] font-semibold bg-charcoal/4 dark:bg-white/5" title="Locked for payroll">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Locked
                </span>
              ) : onFix ? (
                <button onClick={() => onFix(r.session, r.role)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] border border-charcoal/15 dark:border-white/15 text-charcoal/60 dark:text-white/50 text-[11.5px] font-semibold"
                  style={{ background:'#fff', cursor:'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  Fix
                </button>
              ) : null}
            </div>
          )
        })}
        {/* footer */}
        <div className="flex items-center gap-4 px-3.5 py-3 bg-charcoal/3 dark:bg-white/5" style={{ borderTop:'1px solid #eef0ec' }}>
          <div>
            <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase">Worked</div>
            <div className="font-mono text-[14px] font-semibold mt-0.5">{ehDurLabel(total)}</div>
          </div>
          {hourlyRate && (
            <div>
              <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase">Est. Pay</div>
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
