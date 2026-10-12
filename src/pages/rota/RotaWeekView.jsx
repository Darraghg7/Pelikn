import React, { useMemo } from 'react'
import { format, isToday } from 'date-fns'
import { staffColour } from '../../lib/utils'
import { buildRotaWeek } from '../../lib/rota'

/** @type {Record<string, import('../../lib/rota').RotaUnavailability>} */
const NO_UNAVAILABILITY = {}
const NO_DAYS = []
const NO_DATES = new Set()
const NO_CROSS = []
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function fmtGBP(amount) {
  return `£${Number(amount).toFixed(2)}`
}


/* ── Desktop Week Table ───────────────────────────────────────────────────── */
function DesktopWeekTable({ week, onCellClick, onToggleAvailability, currentStaffId, isManager, closureMode, onToggleClosure, breakDurationMins }) {
  const { staff, weekCost: weeklyTotal } = week
  const days = week.days.map((d) => d.date)
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white dark:bg-paperDark w-36 text-left px-5 py-3 text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium border-b border-charcoal/8 dark:border-white/8 z-10">
              Staff
            </th>
            {days.map((d, i) => {
              const today    = isToday(d)
              const { dateStr, closed: isClosed, closedByDate: isDbClosed } = week.days[i]
              return (
                <th
                  key={i}
                  onClick={closureMode ? () => onToggleClosure(dateStr) : undefined}
                  className={[
                    'px-3 py-3 border-b border-charcoal/8 dark:border-white/8 text-center min-w-[96px] transition-colors',
                    closureMode ? 'cursor-pointer hover:bg-danger/10' : '',
                    isClosed    ? 'bg-charcoal/5 dark:bg-white/5' : today ? 'bg-accent/5' : '',
                    closureMode && isDbClosed ? 'bg-danger/8 ring-1 ring-danger/20' : '',
                  ].join(' ')}>
                  <p className={[
                    'text-micro tracking-widest font-medium',
                    isClosed ? 'text-charcoal/25 dark:text-white/25' : today ? 'text-accent' : 'text-charcoal/35 dark:text-white/30',
                  ].join(' ')}>{DAY_LABELS[i]}</p>
                  <p className={[
                    'text-sm font-medium',
                    isClosed ? 'text-charcoal/25 dark:text-white/25' : today ? 'text-accent' : 'text-charcoal dark:text-white',
                  ].join(' ')}>{format(d, 'd MMM')}</p>
                  {isClosed && !closureMode && (
                    <p className="text-[8px] tracking-widest uppercase text-charcoal/20 dark:text-white/20 font-semibold mt-0.5">Closed</p>
                  )}
                  {closureMode && (
                    <p className={`text-[8px] tracking-widest uppercase font-semibold mt-0.5 ${isDbClosed ? 'text-danger/60' : 'text-charcoal/20 dark:text-white/20'}`}>
                      {isDbClosed ? 'Tap to unmark' : 'Tap to close'}
                    </p>
                  )}
                </th>
              )
            })}
            {isManager && (
              <th className="px-4 py-3 border-b border-charcoal/8 dark:border-white/8 text-right text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium whitespace-nowrap min-w-[80px]">
                Est. Cost
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => {
            const isUnder18   = s.is_under_18 ?? false
            const { paidHours: totalHrs, breakCount, breakMins: totalBreakMins, cost: wageCost } = week.personTotals(s.id)
            const isOwnStaff  = !isManager && currentStaffId === s.id

            return (
              <tr key={s.id} className={isOwnStaff ? 'bg-accent/3' : ''}>
                <td className="sticky left-0 bg-white dark:bg-paperDark px-5 py-3 border-b border-charcoal/5 dark:border-white/5 z-10 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {s._crossVenue && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: staffColour(s) }}
                      />
                    )}
                    <div>
                      <p className="font-medium text-charcoal dark:text-white text-sm">{s.name}</p>
                      <p className="text-micro tracking-widest uppercase text-charcoal/30 dark:text-white/30">{s.job_title ?? s.role}</p>
                    </div>
                    {isOwnStaff && (
                      <span className="text-[9px] tracking-widest uppercase bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium">You</span>
                    )}
                    {s._crossVenue && (
                      <span className="text-[9px] tracking-widest uppercase bg-indigo-50 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">Visiting</span>
                    )}
                  </div>
                </td>
                {days.map((d, di) => {
                  const today     = isToday(d)
                  const { closed: isClosed, shifts: dayShifts, unavail, isTimeOff, isManualOff, crossShift } = week.cell(s.id, week.days[di].dateStr)
                  const isBreakCover = false

                  if (isClosed) {
                    return (
                      <td key={di} className="border-b border-charcoal/5 dark:border-white/5 px-2 py-2 align-top bg-charcoal/4 dark:bg-white/5 min-w-[96px]">
                        <div className="h-10" />
                      </td>
                    )
                  }

                  const canClick = isManager || (isOwnStaff && dayShifts.length > 0)

                  return (
                    <td
                      key={di}
                      className={[
                        'border-b border-charcoal/5 dark:border-white/5 px-2 py-2 align-top transition-colors min-w-[96px]',
                        isTimeOff && dayShifts.length === 0
                          ? 'bg-danger/8'
                          : crossShift && dayShifts.length === 0
                            ? 'bg-indigo-50/40'
                            : isManualOff && dayShifts.length === 0
                              ? 'bg-charcoal/6 dark:bg-white/8'
                              : today ? 'bg-accent/5' : '',
                      ].join(' ')}
                    >
                      {dayShifts.length === 0 ? (
                        crossShift ? (
                          <div
                            className="h-10 flex flex-col items-center justify-center rounded-tag border border-indigo-200/60 px-1 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,theme(colors.indigo.500/8%)_3px,theme(colors.indigo.500/8%)_6px)]"
                          >
                            <span className="text-[8px] tracking-widest uppercase text-indigo-400 font-semibold leading-tight">Busy</span>
                            <span className="text-[8px] text-indigo-300 truncate max-w-full px-1">{crossShift.venue_name}</span>
                          </div>
                        ) : isTimeOff ? (
                          <div className="h-10 flex items-center justify-center rounded-tag bg-danger/10 border border-danger/20">
                            <span className="text-[9px] tracking-widest uppercase text-danger/70 font-semibold">Time Off</span>
                          </div>
                        ) : isBreakCover ? (
                          null
                        ) : isManualOff ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleAvailability?.(s.id, d) }}
                              className="h-7 flex items-center justify-center rounded-tag bg-charcoal/8 dark:bg-white/8 border border-charcoal/15 dark:border-white/15 hover:bg-charcoal/12 dark:hover:bg-white/15 transition-colors cursor-pointer"
                            >
                              <span className="text-[8px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">Unavail</span>
                            </button>
                            {isManager && (
                              <button
                                onClick={() => onCellClick(s, d, dayShifts)}
                                className="h-6 flex items-center justify-center text-micro rounded-tag border border-dashed border-charcoal/12 dark:border-white/15 hover:border-charcoal/25 dark:hover:border-white/25 text-charcoal/20 dark:text-white/20 hover:text-charcoal/40 dark:hover:text-white/35 transition-colors cursor-pointer"
                              >+</button>
                            )}
                          </div>
                        ) : isManager ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => onCellClick(s, d, dayShifts)}
                              className="h-7 flex items-center justify-center text-xs rounded-tag border border-dashed border-charcoal/12 dark:border-white/15 hover:border-charcoal/25 dark:hover:border-white/25 text-charcoal/20 dark:text-white/20 hover:text-charcoal/40 dark:hover:text-white/35 transition-colors cursor-pointer"
                            >+</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleAvailability?.(s.id, d) }}
                              className="h-5 flex items-center justify-center text-[8px] tracking-wider uppercase rounded-tag text-charcoal/20 dark:text-white/20 hover:text-charcoal/40 dark:hover:text-white/35 hover:bg-charcoal/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              avail
                            </button>
                          </div>
                        ) : isOwnStaff ? (
                          <div className="h-10 flex items-center justify-center text-charcoal/15 dark:text-white/15 text-xs rounded-tag border border-dashed border-charcoal/8 dark:border-white/8">
                            —
                          </div>
                        ) : (
                          <div className="h-10" />
                        )
                      ) : (
                        <div className="flex flex-col gap-1">
                          {dayShifts.map((sh) => (
                            <div
                              key={sh.id}
                              onClick={canClick ? () => onCellClick(s, d, dayShifts) : undefined}
                              className={[
                                'rounded-tag px-2 py-1.5 text-xs relative text-white',
                                canClick ? 'cursor-pointer' : '',
                                isOwnStaff && !isManager ? 'ring-2 ring-accent ring-offset-1' : '',
                                unavail ? 'ring-2 ring-warning ring-offset-1' : '',
                              ].join(' ')}
                              style={{ backgroundColor: staffColour(s) }}
                            >
                              <p className="font-medium">{sh.start_time?.slice(0,5) ?? ''}&ndash;{sh.end_time?.slice(0,5) ?? ''}</p>
                              <p className="opacity-60 truncate text-caption">{sh.role_label}</p>
                              {isOwnStaff && !isManager && (
                                <span className="absolute -top-1 -right-1 bg-accent text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">↔</span>
                              )}
                              {unavail && (
                                <span className="absolute -top-1 -left-1 bg-warning text-white text-[7px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">!</span>
                              )}
                            </div>
                          ))}
                          {isManager && !isTimeOff && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleAvailability?.(s.id, d) }}
                              className="h-4 flex items-center justify-center text-[7px] tracking-wider uppercase rounded-tag text-charcoal/15 dark:text-white/15 hover:text-charcoal/40 dark:hover:text-white/35 hover:bg-charcoal/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              {isManualOff ? 'unavail' : ''}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
                {isManager && (
                  <td className="border-b border-charcoal/5 dark:border-white/5 px-4 py-3 text-right align-middle">
                    {wageCost > 0 ? (
                      <div>
                        <p className="font-mono text-sm font-semibold text-charcoal dark:text-white">{fmtGBP(wageCost)}</p>
                        <p className="text-caption text-charcoal/35 dark:text-white/30">{totalHrs.toFixed(1)}h paid</p>
                        {breakCount > 0 && (
                          <p className="text-[9px] text-charcoal/25 dark:text-white/25">
                            {breakCount > 1
                              ? `${breakCount} × ${isUnder18 ? '30' : breakDurationMins}m breaks (${totalBreakMins}m)`
                              : `${totalBreakMins}m break`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-charcoal/20 dark:text-white/20 text-xs">-</p>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        {isManager && weeklyTotal > 0 && (
          <tfoot>
            <tr>
              <td colSpan={days.length + 1} className="px-5 py-3 text-right text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35">
                Total weekly wage bill
              </td>
              <td className="px-4 py-3 text-right">
                <p className="font-mono font-bold text-charcoal dark:text-white">{fmtGBP(weeklyTotal)}</p>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/* ── Exported component — responsive wrapper ─────────────────────────────── */
export default function RotaWeekView({
  weekStart,
  shifts,
  staff,
  onCellClick,
  onToggleAvailability,
  currentStaffId = null,
  isManager = true,
  unavailability = NO_UNAVAILABILITY,
  closedDays = NO_DAYS,
  closedDates = NO_DATES,
  closureMode = false,
  onToggleClosure = null,
  breakDurationMins = 30,
  crossShifts = NO_CROSS,
}) {
  // One model of the week (shifts by person and day, closed days, leave,
  // totals) shared with the phone rota: see src/lib/rota/week.ts.
  const week = useMemo(
    () => buildRotaWeek({ weekStart, shifts, staff, unavailability, closedDays, closedDates, crossShifts, breakDurationMins }),
    [weekStart, shifts, staff, unavailability, closedDays, closedDates, crossShifts, breakDurationMins],
  )

  if (staff.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-charcoal/35 dark:text-white/30 italic">
        No staff members found. Add staff in Settings.
      </div>
    )
  }

  const sharedProps = { week, onCellClick, onToggleAvailability, currentStaffId, isManager, closureMode, onToggleClosure, breakDurationMins }

  return <DesktopWeekTable {...sharedProps} />
}
