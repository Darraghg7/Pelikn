import React, { useState, useEffect, useMemo } from 'react'
import { format, isToday } from 'date-fns'
import { getWeekDays, staffColour } from '../../lib/utils'
import { shiftDurationHours, paidShiftHours, unpaidBreakMins } from '../../hooks/useShifts'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function fmtGBP(amount) {
  return `£${Number(amount).toFixed(2)}`
}


/* ── Mobile Day View ─────────────────────────────────────────────────────── */
function MobileDayView({ days, shifts, shiftIndex, staff, onCellClick, currentStaffId, isManager, unavailability, closedDays, closedDates, closureMode, onToggleClosure, crossShifts = [] }) {
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
  const isClosed = closedDays.includes(selectedDay) || closedDates.has(dateStr)
  const isDbClosed = closedDates.has(dateStr)

  // All shifts for this day across all staff
  const dayShifts = shifts.filter(sh => sh.shift_date === dateStr)  // used for "has shifts" dot only

  return (
    <div className="flex flex-col gap-3">
      {/* Day selector scrollable pills */}
      <div className="overflow-x-auto -mx-0 scrollbar-hide">
        <div className="flex gap-2 pb-1">
          {days.map((d, i) => {
            const today   = isToday(d)
            const dStr    = format(d, 'yyyy-MM-dd')
            const closed  = closedDays.includes(i) || closedDates.has(dStr)
            const dbClosed = closedDates.has(dStr)
            const active  = i === selectedDay
            const hasShifts = shifts.some(sh => sh.shift_date === dStr)
            return (
              <button
                key={i}
                onClick={() => closureMode ? onToggleClosure?.(dStr) : setSelectedDay(i)}
                className={[
                  'flex flex-col items-center px-3 py-2 rounded-xl shrink-0 border transition-all min-w-[54px]',
                  closureMode && dbClosed ? 'bg-danger/10 border-danger/30 text-danger' :
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
                {hasShifts && !closed && !closureMode && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 ${active ? 'bg-cream/50' : 'bg-accent'}`} />
                )}
                {closureMode && (
                  <span className={`text-[7px] tracking-widest uppercase mt-0.5 font-bold ${dbClosed ? 'text-danger/60' : 'text-charcoal/20'}`}>
                    {dbClosed ? 'Closed' : '+close'}
                  </span>
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
            <span className="ml-2 text-[11px] tracking-widest uppercase bg-accent/12 text-accent px-2 py-0.5 rounded-full font-medium">Today</span>
          )}
        </h3>
        {isClosed && !closureMode && (
          <span className="text-[11px] tracking-widest uppercase text-charcoal/35 font-semibold">Closed</span>
        )}
        {closureMode && isDbClosed && (
          <button
            onClick={() => onToggleClosure?.(dateStr)}
            className="text-[11px] tracking-widest uppercase text-danger/60 hover:text-danger font-semibold transition-colors"
          >
            Tap to unmark ×
          </button>
        )}
      </div>

      {isClosed && !closureMode ? (
        <div className="py-8 text-center text-sm text-charcoal/30 italic">Venue closed this day.</div>
      ) : dayShifts.length === 0 && !closureMode ? (
        <div className="py-8 text-center">
          <p className="text-sm text-charcoal/35 italic mb-3">No shifts scheduled for this day.</p>
          {isManager && (
            <p className="text-xs text-charcoal/30">Tap a staff member to add a shift.</p>
          )}
        </div>
      ) : null}

      {/* Staff list for this day — hidden on closed days */}
      {!isClosed && (
      <div className="flex flex-col gap-2">
        {staff.map(s => {
          const staffDayShifts = shiftIndex[`${s.id}:${dateStr}`] ?? []
          const unavail        = unavailability[`${s.id}:${dateStr}`]
          const isOwnStaff     = !isManager && currentStaffId === s.id
          const isTimeOff      = unavail?.type === 'time_off'
          const canClick       = isManager || (isOwnStaff && staffDayShifts.length > 0)
          const crossShift     = s._crossVenue ? crossShifts.find(cs => cs.staff_id === s.id && cs.shift_date === dateStr) : null

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
                crossShift && staffDayShifts.length === 0 ? 'bg-indigo-50/60 border-indigo-200' : '',
              ].join(' ')}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {s._crossVenue && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: staffColour(s) }}
                    />
                  )}
                  <p className="text-sm font-medium text-charcoal truncate">{s.name}</p>
                  {isOwnStaff && (
                    <span className="text-[9px] tracking-widest uppercase bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium shrink-0">You</span>
                  )}
                  {s._crossVenue && (
                    <span className="text-[9px] tracking-widest uppercase bg-indigo-50 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">Visiting</span>
                  )}
                </div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/35 mt-0.5">{s.job_role ?? s.role}</p>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                {staffDayShifts.length === 0 ? (
                  crossShift ? (
                    <span className="text-[11px] font-semibold text-indigo-400 tracking-wide">Busy · {crossShift.venue_name}</span>
                  ) : isTimeOff ? (
                    <span className="text-[11px] font-semibold text-danger tracking-wide">Time Off</span>
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
                        <span className="text-[11px] text-charcoal/40 tracking-wide">{sh.role_label}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

/* ── Desktop Week Table ───────────────────────────────────────────────────── */
function DesktopWeekTable({ days, shifts, shiftIndex, staff, onCellClick, onToggleAvailability, currentStaffId, isManager, unavailability, closedDays, closedDates, closureMode, onToggleClosure, weeklyTotal, breakDurationMins, crossShifts = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white w-36 text-left px-5 py-3 text-[11px] tracking-widest uppercase text-charcoal/40 font-medium border-b border-charcoal/8 z-10">
              Staff
            </th>
            {days.map((d, i) => {
              const today    = isToday(d)
              const dateStr  = format(d, 'yyyy-MM-dd')
              const isClosed = closedDays.includes(i) || closedDates.has(dateStr)
              const isDbClosed = closedDates.has(dateStr)
              return (
                <th
                  key={i}
                  onClick={closureMode ? () => onToggleClosure(dateStr) : undefined}
                  className={[
                    'px-3 py-3 border-b border-charcoal/8 text-center min-w-[96px] transition-colors',
                    closureMode ? 'cursor-pointer hover:bg-danger/10' : '',
                    isClosed    ? 'bg-charcoal/5' : today ? 'bg-accent/5' : '',
                    closureMode && isDbClosed ? 'bg-danger/8 ring-1 ring-danger/20' : '',
                  ].join(' ')}>
                  <p className={[
                    'text-[11px] tracking-widest font-medium',
                    isClosed ? 'text-charcoal/25' : today ? 'text-accent' : 'text-charcoal/35',
                  ].join(' ')}>{DAY_LABELS[i]}</p>
                  <p className={[
                    'text-sm font-medium',
                    isClosed ? 'text-charcoal/25' : today ? 'text-accent' : 'text-charcoal',
                  ].join(' ')}>{format(d, 'd MMM')}</p>
                  {isClosed && !closureMode && (
                    <p className="text-[8px] tracking-widest uppercase text-charcoal/20 font-semibold mt-0.5">Closed</p>
                  )}
                  {closureMode && (
                    <p className={`text-[8px] tracking-widest uppercase font-semibold mt-0.5 ${isDbClosed ? 'text-danger/60' : 'text-charcoal/20'}`}>
                      {isDbClosed ? 'Tap to unmark' : 'Tap to close'}
                    </p>
                  )}
                </th>
              )
            })}
            {isManager && (
              <th className="px-4 py-3 border-b border-charcoal/8 text-right text-[11px] tracking-widest uppercase text-charcoal/40 font-medium whitespace-nowrap min-w-[80px]">
                Est. Cost
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => {
            // Gather all shifts for this staff member across all rendered days
            const staffShifts = days.flatMap(d => shiftIndex[`${s.id}:${format(d, 'yyyy-MM-dd')}`] ?? [])
            const isUnder18   = s.is_under_18 ?? false
            const totalHrs    = staffShifts.reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, isUnder18, breakDurationMins), 0)
            const rawHrs      = staffShifts.reduce((acc, sh) => acc + shiftDurationHours(sh.start_time, sh.end_time), 0)
            const wageCost    = totalHrs * (s.hourly_rate ?? 0)
            const isOwnStaff  = !isManager && currentStaffId === s.id

            return (
              <tr key={s.id} className={isOwnStaff ? 'bg-accent/3' : ''}>
                <td className="sticky left-0 bg-white px-5 py-3 border-b border-charcoal/5 z-10 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {s._crossVenue && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: staffColour(s) }}
                      />
                    )}
                    <div>
                      <p className="font-medium text-charcoal text-sm">{s.name}</p>
                      <p className="text-[11px] tracking-widest uppercase text-charcoal/30">{s.job_role ?? s.role}</p>
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
                  const dateStr   = format(d, 'yyyy-MM-dd')
                  const today     = isToday(d)
                  const isClosed  = closedDays.includes(di) || closedDates.has(dateStr)
                  const dayShifts = shiftIndex[`${s.id}:${dateStr}`] ?? []
                  const unavail   = unavailability[`${s.id}:${dateStr}`]
                  const isTimeOff = unavail?.type === 'time_off'
                  const isManualOff = unavail?.type === 'manual'
                  const isBreakCover = false
                  const crossShift = s._crossVenue ? crossShifts.find(cs => cs.staff_id === s.id && cs.shift_date === dateStr) : null

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
                          : crossShift && dayShifts.length === 0
                            ? 'bg-indigo-50/40'
                            : isManualOff && dayShifts.length === 0
                              ? 'bg-charcoal/6'
                              : today ? 'bg-accent/5' : '',
                      ].join(' ')}
                    >
                      {dayShifts.length === 0 ? (
                        crossShift ? (
                          <div
                            className="h-10 flex flex-col items-center justify-center rounded border border-indigo-200/60 px-1"
                            style={{ background: 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(99,102,241,0.08) 3px, rgba(99,102,241,0.08) 6px)' }}
                          >
                            <span className="text-[8px] tracking-widest uppercase text-indigo-400 font-semibold leading-tight">Busy</span>
                            <span className="text-[8px] text-indigo-300 truncate max-w-full px-1">{crossShift.venue_name}</span>
                          </div>
                        ) : isTimeOff ? (
                          <div className="h-10 flex items-center justify-center rounded bg-danger/10 border border-danger/20">
                            <span className="text-[9px] tracking-widest uppercase text-danger/70 font-semibold">Time Off</span>
                          </div>
                        ) : isBreakCover ? (
                          null
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
                                className="h-6 flex items-center justify-center text-[11px] rounded border border-dashed border-charcoal/12 hover:border-charcoal/25 text-charcoal/20 hover:text-charcoal/40 transition-colors cursor-pointer"
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
                                'rounded px-2 py-1.5 text-xs relative text-white',
                                canClick ? 'cursor-pointer' : '',
                                isOwnStaff && !isManager ? 'ring-2 ring-accent ring-offset-1' : '',
                                unavail ? 'ring-2 ring-warning ring-offset-1' : '',
                              ].join(' ')}
                              style={{ backgroundColor: staffColour(s) }}
                            >
                              <p className="font-medium">{sh.start_time.slice(0,5)}&ndash;{sh.end_time.slice(0,5)}</p>
                              <p className="opacity-60 truncate text-[11px]">{sh.role_label}</p>
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
                              {isManualOff ? 'unavail' : ''}
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
                        <p className="text-[11px] text-charcoal/35">{totalHrs.toFixed(1)}h paid</p>
                        {rawHrs !== totalHrs && (
                          <p className="text-[9px] text-charcoal/25">{isUnder18 ? '30m' : `${breakDurationMins}m`} break</p>
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
              <td colSpan={days.length + 1} className="px-5 py-3 text-right text-[11px] tracking-widest uppercase text-charcoal/40">
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
  closedDates = new Set(),
  closureMode = false,
  onToggleClosure = null,
  breakDurationMins = 30,
  crossShifts = [],
}) {
  const days = getWeekDays(weekStart)

  // Pre-index shifts by "staffId:date" for O(1) lookup in cell rendering
  const shiftIndex = useMemo(() => {
    const idx = {}
    for (const sh of shifts) {
      const key = `${sh.staff_id}:${sh.shift_date}`
      if (!idx[key]) idx[key] = []
      idx[key].push(sh)
    }
    return idx
  }, [shifts])

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
    const hrs = staffShifts.reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, isUnder18, breakDurationMins), 0)
    return total + hrs * (s.hourly_rate ?? 0)
  }, 0)

  const sharedProps = { days, shifts, shiftIndex, staff, onCellClick, onToggleAvailability, currentStaffId, isManager, unavailability, closedDays, closedDates, closureMode, onToggleClosure, breakDurationMins, crossShifts }

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
