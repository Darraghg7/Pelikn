import React, { useMemo, memo } from 'react'
import { format } from 'date-fns'
import { unpaidBreakMins } from '../../hooks/useShifts'
import { formatMinutes } from '../../lib/utils'

function fmtTime(iso) {
  if (!iso) return '?'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

/**
 * ok         — on time or surplus (within grace period)
 * minor      — 1–30 min short beyond grace
 * significant — >30 min short beyond grace
 * absent     — scheduled but no clock events
 */
function discrepancyStatus(actualMins, expectedMins, cleanupMins) {
  if (expectedMins === undefined) return null
  if (actualMins === 0)           return 'absent'
  const delta = expectedMins - actualMins
  if (delta <= cleanupMins) return 'ok'
  if (delta <= 30)          return 'minor'
  return 'significant'
}

const DrillDownPanel = memo(function DrillDownPanel({
  person, gridDays, shiftsForPerson, cleanupMinutes,
  breakDurationMins, isUnder18,
  adminMode, onDeleteSession, onAddForPerson, onEditSession,
}) {
  const shiftsByDate = useMemo(() => {
    const map = {}
    for (const sh of shiftsForPerson) {
      if (!map[sh.shift_date]) map[sh.shift_date] = []
      map[sh.shift_date].push(sh)
    }
    return map
  }, [shiftsForPerson])

  const activeDays = gridDays.filter(d => {
    const dateStr = format(d, 'yyyy-MM-dd')
    return person.days[dateStr] || shiftsByDate[dateStr]
  })

  if (activeDays.length === 0) {
    return (
      <div className="mx-4 mb-2 p-3 rounded-xl bg-charcoal/3 text-xs text-charcoal/35 italic flex items-center justify-between">
        <span>No clock events or scheduled shifts this week.</span>
        {adminMode && (
          <button
            onClick={() => onAddForPerson(person.staffId, '')}
            className="text-[11px] text-brand/70 hover:text-brand transition-colors font-medium shrink-0"
          >
            + Add Session
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-4 mb-2 rounded-2xl border border-charcoal/8 bg-white overflow-hidden">
      {activeDays.map((d, i) => {
        const dateStr   = format(d, 'yyyy-MM-dd')
        const dayData   = person.days[dateStr]
        const dayShifts = shiftsByDate[dateStr] ?? []
        const actual    = dayData?.minutes ?? 0
        const expected  = dayShifts.reduce((acc, sh) => {
          const [sh_h, sh_m] = sh.start_time.split(':').map(Number)
          const [eh, em]     = sh.end_time.split(':').map(Number)
          const rawMins = (eh * 60 + em) - (sh_h * 60 + sh_m)
          return acc + rawMins - unpaidBreakMins(rawMins / 60, isUnder18, breakDurationMins)
        }, 0)
        const status = discrepancyStatus(actual, expected || undefined, cleanupMinutes)

        return (
          <div key={dateStr} className={['px-4 py-3', i > 0 ? 'border-t border-charcoal/6' : ''].join(' ')}>
            {/* Day header */}
            <p className="text-[11px] tracking-widest uppercase text-charcoal/45 font-semibold mb-2">
              {format(d, 'EEE d MMM')}
            </p>

            {/* Absent */}
            {status === 'absent' && (
              <p className="text-xs text-danger font-medium">
                <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Absent</span>
                {dayShifts.length > 0 && (
                  <span className="text-charcoal/40 font-normal ml-1">
                    — scheduled {dayShifts.map(sh => `${sh.start_time.slice(0,5)}–${sh.end_time.slice(0,5)}`).join(', ')}
                    {' '}({formatMinutes(expected)})
                  </span>
                )}
              </p>
            )}

            {/* Sessions */}
            {dayData?.sessions.map((s, si) => {
              const sessionWorked = s.out
                ? Math.max(0, (new Date(s.out) - new Date(s.in)) / 60000
                    - s.breaks.reduce((acc, b) =>
                      (!b.start || !b.end) ? acc : acc + (new Date(b.end) - new Date(b.start)) / 60000, 0))
                : null

              const eventIds = [s.inId, s.outId, ...s.breaks.flatMap(b => [b.startId, b.endId])].filter(Boolean)

              return (
                <div key={si} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs mb-1">
                  <span className="text-charcoal/40 font-medium">Clock in:</span>
                  <span className="font-mono text-charcoal font-semibold">{fmtTime(s.in)}</span>

                  {s.breaks.filter(b => b.start && b.end).map((b, bi) => (
                    <React.Fragment key={bi}>
                      <span className="text-charcoal/30">·</span>
                      <span className="text-charcoal/40">Break:</span>
                      <span className="font-mono text-charcoal/60">{fmtTime(b.start)}–{fmtTime(b.end)}</span>
                    </React.Fragment>
                  ))}

                  <span className="text-charcoal/30">·</span>
                  <span className="text-charcoal/40 font-medium">Clock out:</span>
                  <span className={['font-mono font-semibold', s.out ? 'text-charcoal' : 'text-charcoal/30 italic'].join(' ')}>
                    {s.out ? fmtTime(s.out) : 'still in'}
                  </span>

                  {sessionWorked !== null && (
                    <>
                      <span className="text-charcoal/30">·</span>
                      <span className="font-mono text-charcoal/60">{formatMinutes(Math.round(sessionWorked))}</span>
                    </>
                  )}


                  {adminMode && (
                    <>
                      <button
                        onClick={() => onEditSession(s)}
                        className="ml-1 text-charcoal/45 hover:text-charcoal text-[11px] border border-charcoal/15 hover:border-charcoal/35 rounded px-1.5 py-0.5 transition-colors leading-none shrink-0"
                        title="Edit this session"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteSession(eventIds)}
                        className="ml-1 text-danger/50 hover:text-danger text-[11px] border border-danger/20 hover:border-danger/50 rounded px-1.5 py-0.5 transition-colors leading-none shrink-0"
                        title="Remove this session"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              )
            })}

            {/* Shift comparison */}
            {dayShifts.length > 0 && status !== 'absent' && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-charcoal/45">
                <span>Scheduled:</span>
                <span className="font-mono">
                  {dayShifts.map(sh => `${sh.start_time.slice(0,5)}–${sh.end_time.slice(0,5)}`).join(', ')}
                  {' '}({formatMinutes(expected)})
                </span>
                <span className="text-charcoal/30">·</span>
                {status === 'ok'          && <span className="text-success font-medium inline-flex items-center gap-0.5"><svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> On time</span>}
                {status === 'minor'       && <span className="text-warning font-medium inline-flex items-center gap-0.5"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {formatMinutes(Math.round(expected - actual))} short</span>}
                {status === 'significant' && <span className="text-danger font-medium inline-flex items-center gap-0.5"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> {formatMinutes(Math.round(expected - actual))} short</span>}
              </div>
            )}

            {/* Per-day add button (admin mode) */}
            {adminMode && (
              <button
                onClick={() => onAddForPerson(person.staffId, dateStr)}
                className="mt-2 text-[11px] text-brand/60 hover:text-brand transition-colors"
              >
                + Add session for this day
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
})

export default DrillDownPanel
