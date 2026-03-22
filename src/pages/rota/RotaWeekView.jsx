import React, { useState, useEffect } from 'react'
import { format, isToday } from 'date-fns'
import { getWeekDays } from '../../lib/utils'
import { shiftDurationHours, paidShiftHours, unpaidBreakMins } from '../../hooks/useShifts'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function fmtGBP(amount) {
  return `£${Number(amount).toFixed(2)}`
}

/* ── Mobile Day View ─────────────────────────────────────────────────────── */
function MobileDayView({ days, shifts, staff, onCellClick, currentStaffId, isManager, unavailability, closedDays }) {
  // Default to today's index within the week (0–6), or 0 if today isn't in this week
  const todayIdx = days.findIndex(d => isToday(d))
  const [selectedDay, setSelectedDay] = useState(todayIdx >= 0 ? todayIdx : 0)

  // When week changes, reset to today if in week
  useEffect(() => {
    const idx = days.findIndex(d => isToday(d))
    setSelectedDay(idx >= 0 ? idx : 0)
  }, [days[0]?.toISOString()])

  const day      = days[selectedDay]
  const dateStr  = format(day, 'yyyy-MM-dd')
  const isClosed = closedDays.includes(selectedDay)

  // All shifts for this day across all staff
  const dayShifts = shifts.filter(sh => sh.shift_date === dateStr)

  return (
    <div className="flex flex-col gap-3">
      {/* Day selector scrollable pills */}
      <div className="overflow-x-auto -mx-0 scrollbar-hide">
        <div className="flex gap-2 pb-1">
          {days.map((d, i) => {
            const today   = isToday(d)
            const closed  = closedDays.includes(i)
            const active  = i === selectedDay
            const hasShifts = shifts.some(sh => sh.shift_date === format(d, 'yyyy-MM-dd'))
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={[
                  'flex flex-col items-center px-3 py-2 rounded-xl shrink-0 border transition-all min-w-[54px]',
                  active
                    ? 'bg-charcoal text-cream border-charcoal'
                    : today
                      ? 'bg-accent/8 text-accent border-accent/25'
                      : closed
                        ? 'bg-charcoal/4 text-charcoal/25 border-charcoal/8'
                        : 'bg-white text-charcoal/70 border-charcoal/12 hover:border-charcoal/25',
                ].join(' ')}
              >
                <span className="text-[9px] font-semibold tracking-widest uppercase">{DAY_LABELS[i]}</span>
                <span className="text-sm font-semibold mt-0.5">{format(d, 'd')}</span>
                {hasShifts && !closed && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 ${active ? 'bg-cream/50' : 'bg-accent'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-charcoal text-sm">
          {format(day, 'EEEE, d MMMM')}
          {isToday(day) && (
            <span className="ml-2 text-[10px] tracking-widest uppercase bg-accent/12 text-accent px-2 py-0.5 rounded-full font-medium">Today</span>
          )}
        </h3>
        {isClosed && (
          <span className="text-[10px] tracking-widest uppercase text-charcoal/35 font-semibold">Closed</span>
        )}
      </div>

      {isClosed ? (
        <div className="py-8 text-center text-sm text-charcoal/30 italic">Venue closed this day.</div>
      ) : dayShifts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-charcoal/35 italic mb-3">No shifts scheduled for this day.</p>
          {isManager && (
            <p className="text-xs text-charcoal/30">Tap a staff member to add a shift.</p>
          )}
        </div>
      ) : null}

      {/* Staff list for this day */}
      <div className="flex flex-col gap-2">
        {staff.map(s => {
          const staffDayShifts = shifts.filter(sh => sh.staff_id === s.id && sh.shift_date === dateStr)
          const unavail        = unavailability[`${s.id}:${dateStr}`]
          const isOwnStaff     = !isManager && currentStaffId === s.id
          const isTimeOff      = unavail?.type === 'time_off'
          const canClick       = isManager || (isOwnStaff && staffDayShifts.length > 0)

          if (staffDayShifts.length === 0 && !isManager) return null  // staff only see their own

          return (
            <div
              key={s.id}
              onClick={canClick ? () => onCellClick?.(s, day, staffDayShifts) : undefined}
              className={[
                'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                canClick ? 'cursor-pointer active:scale-[0.98]' : '',
                isOwnStaff && !isManager ? 'border-accent/30 bg-accent/4' : 'border-charcoal/10 bg-white',
                isTimeOff && staffDayShifts.length === 0 ? 'bg-danger/5 border-danger/20' : '',
              ].join(' ')}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-charcoal truncate">{s.name}</p>
                  {isOwnStaff && (
                    <span className="text-[9px] tracking-widest uppercase bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium shrink-0">You</span>
                  )}
                </div>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/35 mt-0.5">{s.job_role ?? s.role}</p>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                {staffDayShifts.length === 0 ? (
                  isTimeOff ? (
                    <span className="text-[10px] font-semibold text-danger tracking-wide">Time Off</span>
                  ) : isManager ? (
                    <span className="text-[11px] text-charcoal/25 border border-dashed border-charcoal/15 rounded-lg px-2.5 py-1">+ Add shift</span>
                  ) : (
                    <span className="text-[11px] text-charcoal/25">No shift</span>
                  )
                ) : (
                  staffDayShifts.map(sh => (
                    <div key={sh.id} className="flex flex-col items-end">
                      <span className="font-mono text-sm font-semibold text-charcoal">
                        {sh.start_time.slice(0,5)}–{sh.end_time.slice(0,5)}
                      </span>
                      {sh.role_label && (
                        <span className="text-[10px] text-charcoal/40 tracking-wide">{sh.role_label}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Desktop Week Table ───────────────────────────────────────────────────── */
function DesktopWeekTable({ days, shifts, staff, onCellClick, onToggleAvailability, currentStaffId, isManager, unavailability, closedDays, weeklyTotal }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white w-36 text-left px-5 py-3 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium border-b border-charcoal/8 z-10">
              Staff
            </th>
            {days.map((d, i) => {
              const today = isToday(d)
              const isClosed = closedDays.includes(i)
              return (
                <th key={i} className={[
                  'px-3 py-3 border-b border-charcoal/8 text-center min-w-[96px]',
                  isClosed ? 'bg-charcoal/5' : today ? 'bg-accent/5' : '',
                ].join(' ')}>
                  <p className={[
                    'text-[10px] tracking-widest font-medium',
                    isClosed ? 'text-charcoal/25' : today ? 'text-accent' : 'text-charcoal/35',
                  ].join(' ')}>{DAY_LABELS[i]}</p>
                  <p className={[
                    'text-sm font-medium',
                    isClosed ? 'text-charcoal/25' : today ? 'text-accent' : 'text-charcoal',
                  ].join(' ')}>{format(d, 'd MMM')}</p>
                  {isClosed && (
                    <p className="text-[8px] tracking-widest uppercase text-charcoal/20 font-semibold mt-0.5">Closed</p>
                  )}
                </th>
              )
            })}
            {isManager && (
              <th className="px-4 py-3 border-b border-charcoal/8 text-right text-[10px] tracking-widest uppercase text-charcoal/40 font-medium whitespace-nowrap min-w-[80px]">
                Est. Cost
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => {
            const staffShifts = shifts.filter((sh) => sh.staff_id === s.id)
            const isUnder18   = s.is_under_18 ?? false
            const totalHrs    = staffShifts.reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, isUnder18), 0)
            const rawHrs      = staffShifts.reduce((acc, sh) => acc + shiftDurationHours(sh.start_time, sh.end_time), 0)
            const wageCost    = totalHrs * (s.hourly_rate ?? 0)
            const isOwnStaff  = !isManager && currentStaffId === s.id

            return (
              <tr key={s.id} className={isOwnStaff ? 'bg-accent/3' : ''}>
                <td className="sticky left-0 bg-white px-5 py-3 border-b border-charcoal/5 z-10 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-charcoal text-sm">{s.name}</p>
                      <p className="text-[10px] tracking-widest uppercase text-charcoal/30">{s.job_role ?? s.role}</p>
                    </div>
                    {isOwnStaff && (
                      <span className="text-[9px] tracking-widest uppercase bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium">You</span>
                    )}
                  </div>
                </td>
                {days.map((d, di) => {
                  const dateStr   = format(d, 'yyyy-MM-dd')
                  const today     = isToday(d)
                  const isClosed  = closedDays.includes(di)
                  const dayShifts = shifts.filter((sh) => sh.staff_id === s.id && sh.shift_date === dateStr)
                  const unavail   = unavailability[`${s.id}:${dateStr}`]
                  const isTimeOff = unavail?.type === 'time_off'
                  const isManualOff = unavail?.type === 'manual' && unavail?.subtype !== 'break_cover'
                  const isBreakCover = unavail?.type === 'manual' && unavail?.subtype === 'break_cover'

                  if (isClosed) {
                    return (
                      <td key={di} className="border-b border-charcoal/5 px-2 py-2 align-top bg-charcoal/4 min-w-[96px]">
                        <div className="h-10" />
                      </td>
                    )
                  }

                  const canClick = isManager || (isOwnStaff && dayShifts.length > 0)

                  return (
                    <td
                      key={di}
                      className={[
                        'border-b border-charcoal/5 px-2 py-2 align-top transition-colors min-w-[96px]',
                        isTimeOff && dayShifts.length === 0
                          ? 'bg-danger/8'
                          : isBreakCover && dayShifts.length === 0
                            ? 'bg-amber-50'
                            : isManualOff && dayShifts.length === 0
                              ? 'bg-charcoal/6'
                              : today ? 'bg-accent/5' : '',
                      ].join(' ')}
                    >
                      {dayShifts.length === 0 ? (
                        isTimeOff ? (
                          <div className="h-10 flex items-center justify-center rounded bg-danger/10 border border-danger/20">
                            <span className="text-[9px] tracking-widest uppercase text-danger/70 font-semibold">Time Off</span>
                          </div>
                        ) : isBreakCover ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleAvailability?.(s.id, d) }}
                              className="h-7 flex items-center justify-center rounded bg-amber-100 border border-amber-200 hover:bg-amber-200 transition-colors cursor-pointer"
                            >
                              <span className="text-[8px] tracking-widest uppercase text-amber-600 font-semibold">Break Cover</span>
                            </button>
                            {isManager && (
                              <button
                                onClick={() => onCellClick(s, d, dayShifts)}
                                className="h-6 flex items-center justify-center text-[10px] rounded border border-dashed border-charcoal/12 hover:border-charcoal/25 text-charcoal/20 hover:text-charcoal/40 transition-colors cursor-pointer"
                              >+</button>
                            )}
                          </div>
                        ) : isManualOff ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleAvailability?.(s.id, d) }}
                              className="h-7 flex items-center justify-center rounded bg-charcoal/8 border border-charcoal/15 hover:bg-charcoal/12 transition-colors cursor-pointer"
                            >
                              <span className="text-[8px] tracking-widest uppercase text-charcoal/40 font-semibold">Unavail</span>
                            </button>
                            {isManager && (
                              <button
                                onClick={() => onCellClick(s, d, dayShifts)}
                                className="h-6 flex items-center justify-center text-[10px] rounded border border-dashed border-charcoal/12 hover:border-charcoal/25 text-charcoal/20 hover:text-charcoal/40 transition-colors cursor-pointer"
                              >+</button>
                            )}
                          </div>
                        ) : isManager ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => onCellClick(s, d, dayShifts)}
                              className="h-7 flex items-center justify-center text-xs rounded border border-dashed border-charcoal/12 hover:border-charcoal/25 text-charcoal/20 hover:text-charcoal/40 transition-colors cursor-pointer"
                            >+</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleAvailability?.(s.id, d) }}
                              className="h-5 flex items-center justify-center text-[8px] tracking-wider uppercase rounded text-charcoal/20 hover:text-charcoal/40 hover:bg-charcoal/5 transition-colors cursor-pointer"
                            >
                              avail
                            </button>
                          </div>
                        ) : isOwnStaff ? (
                          <div className="h-10 flex items-center justify-center text-charcoal/15 text-xs rounded border border-dashed border-charcoal/8">
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
                                'rounded px-2 py-1.5 text-xs relative bg-charcoal text-cream',
                                canClick ? 'cursor-pointer' : '',
                                isOwnStaff && !isManager ? 'ring-2 ring-accent ring-offset-1' : '',
                                unavail ? 'ring-2 ring-warning ring-offset-1' : '',
                              ].join(' ')}
                            >
                              <p className="font-medium">{sh.start_time.slice(0,5)}&ndash;{sh.end_time.slice(0,5)}</p>
                              <p className="opacity-50 truncate text-[10px]">{sh.role_label}</p>
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
                              className="h-4 flex items-center justify-center text-[7px] tracking-wider uppercase rounded text-charcoal/15 hover:text-charcoal/40 hover:bg-charcoal/5 transition-colors cursor-pointer"
                            >
                              {isManualOff ? 'unavail' : isBreakCover ? 'break' : ''}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
                {isManager && (
                  <td className="border-b border-charcoal/5 px-4 py-3 text-right align-middle">
                    {wageCost > 0 ? (
                      <div>
                        <p className="font-mono text-sm font-semibold text-charcoal">{fmtGBP(wageCost)}</p>
                        <p className="text-[10px] text-charcoal/35">{totalHrs.toFixed(1)}h paid</p>
                        {rawHrs !== totalHrs && (
                          <p className="text-[9px] text-charcoal/25">{isUnder18 ? '30m' : '20m'} break</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-charcoal/20 text-xs">-</p>
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
              <td colSpan={days.length + 1} className="px-5 py-3 text-right text-[10px] tracking-widest uppercase text-charcoal/40">
                Total weekly wage bill
              </td>
              <td className="px-4 py-3 text-right">
                <p className="font-mono font-bold text-charcoal">{fmtGBP(weeklyTotal)}</p>
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
  unavailability = {},
  closedDays = [],
}) {
  const days = getWeekDays(weekStart)

  if (staff.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-charcoal/35 italic">
        No staff members found. Add staff in Settings.
      </div>
    )
  }

  const weeklyTotal = staff.reduce((total, s) => {
    const staffShifts = shifts.filter((sh) => sh.staff_id === s.id)
    const isUnder18 = s.is_under_18 ?? false
    const hrs = staffShifts.reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, isUnder18), 0)
    return total + hrs * (s.hourly_rate ?? 0)
  }, 0)

  const sharedProps = { days, shifts, staff, onCellClick, onToggleAvailability, currentStaffId, isManager, unavailability, closedDays }

  return (
    <>
      {/* Mobile/tablet: single-day card list (< 1024px) */}
      <div className="lg:hidden px-1">
        <MobileDayView {...sharedProps} />
      </div>

      {/* Desktop: full week table (≥ 1024px) */}
      <div className="hidden lg:block">
        <DesktopWeekTable {...sharedProps} weeklyTotal={weeklyTotal} />
      </div>
    </>
  )
}
