import React from 'react'

export default function GanttChart({ shifts, staff, currentStaffId, nowMins, showNow }) {
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
    <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-baseline gap-2.5 px-3.5 pt-3 pb-2">
        <div className="w-16 shrink-0" />
        <div className="flex-1 relative h-3.5">
          {ticks.map(h => {
            const p = pct(h * 60)
            return (
              <span key={h} className="absolute top-0 font-mono text-[10px] text-charcoal/40 dark:text-white/35 font-semibold tracking-[0.04em]"
                style={{ left: `${p}%`, transform: h === 6 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {String(h).padStart(2, '0')}
              </span>
            )
          })}
          {showNow && (
            <span className="absolute top-0 font-mono text-[9px] text-accent font-bold tracking-[0.06em] bg-white dark:bg-paperDark px-1 z-10"
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
              <div className={`w-16 shrink-0 text-[13px] font-semibold truncate flex items-center gap-1 ${isMe ? 'text-brand' : 'text-charcoal/70 dark:text-white/60'}`}>
                <span className="truncate">{(staffMember?.name ?? 'Staff').split(' ')[0]}</span>
                {isMe && <span className="font-mono text-[8px] text-accent font-bold tracking-[0.08em] bg-danger/8 px-1 py-0.5 rounded shrink-0">YOU</span>}
              </div>
              <div className="flex-1 relative h-[22px]">
                {ticks.map((h, ti) => {
                  const p = pct(h * 60)
                  if (p <= 0.5 || p >= 99.5) return null
                  return <span key={ti} className="absolute top-[-8px] bottom-[-8px] w-px bg-charcoal/8 dark:bg-white/8 z-0" style={{ left: `${p}%` }} />
                })}
                {showNow && <span className="absolute top-[-8px] bottom-[-8px] z-10" style={{ left: `${nowPct}%`, width: '1.5px', background: '#c94f2a' }} />}
                <div className="absolute top-0 h-[22px] rounded-full z-20"
                  style={{ left: `${left}%`, width: `${width}%`, background: isMe ? '#13362a' : '#e4e6e2', boxShadow: isMe ? '0 1px 4px rgba(19,54,42,0.3)' : 'none' }} />
              </div>
              <div className="w-28 shrink-0 text-right">
                <div className={`font-mono text-[12px] font-semibold tabular-nums ${isMe ? 'text-brand' : 'text-charcoal/60 dark:text-white/50'}`}>
                  {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                </div>
                {shift.role_label && (
                  <div className="font-mono text-[10px] text-charcoal/50 dark:text-white/40 tracking-[0.05em] font-semibold mt-0.5 uppercase truncate">{shift.role_label}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
