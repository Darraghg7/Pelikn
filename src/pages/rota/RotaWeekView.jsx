import React, { useMemo } from 'react'
import { format, isToday } from 'date-fns'
import { getWeekDays, staffColour } from '../../lib/utils'
import Avatar from '../../components/ui/Avatar'
import { firstName } from '../../lib/names'
import { shiftDurationHours, paidShiftHours, unpaidBreakMins } from '../../hooks/useShifts'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function fmtGBP(amount) {
  return `£${Number(amount).toFixed(2)}`
}


function MobileShiftCell({ shift, accent, onClick }) {
  const canClick = !!onClick
  const startH = shift.start_time?.slice(0, 2) ?? '--'
  const endH   = shift.end_time?.slice(0, 2)   ?? '--'
  const hrs    = shiftDurationHours(shift.start_time, shift.end_time)
  const hrsStr = Number.isFinite(hrs) ? `${Math.round(hrs * 10) / 10}h` : ''
  return (
    <div
      onClick={canClick ? onClick : undefined}
      className={`rounded-[10px] px-2 pt-[7px] pb-[6px] mb-1 last:mb-0${canClick ? ' cursor-pointer active:scale-[0.97] transition-transform' : ''}`}
      style={{ background: accent + '1C' }}
    >
      <div className="font-semibold text-body-sm leading-none tabular-nums" style={{ color: accent }}>
        {startH}–{endH}
      </div>
      <div className="text-micro leading-none mt-[5px] tabular-nums" style={{ color: accent, opacity: 0.65 }}>
        {hrsStr}
      </div>
    </div>
  )
}

function MobileWeekGrid({ days, shifts, shiftIndex, staff, onCellClick, currentStaffId, isManager, unavailability, closedDays, closedDates, breakDurationMins = 30, crossShifts = [] }) {
  const COL_W  = 78
  const NAME_W = 140

  const dayTotals = days.map((d, di) => {
    const dateStr = format(d, 'yyyy-MM-dd')
    if (closedDays.includes(di) || closedDates?.has(dateStr)) return { hours: 0, heads: 0 }
    let hours = 0, heads = 0
    for (const s of staff) {
      const dayShifts = shiftIndex[`${s.id}:${dateStr}`] ?? []
      if (dayShifts.length) {
        heads++
        hours += dayShifts.reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, s.is_under_18 ?? false, breakDurationMins), 0)
      }
    }
    return { hours: Math.round(hours * 10) / 10, heads }
  })

  return (
    <div className="mx-0 rounded-2xl border border-charcoal/8 dark:border-white/8 overflow-hidden bg-white dark:bg-paperDark">
    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: NAME_W + COL_W * 7 + 1 }}>

        {/* Header row */}
        <div className="flex sticky top-0 z-20 bg-white dark:bg-paperDark border-b border-charcoal/8 dark:border-white/8">
          <div className="sticky left-0 z-[21] bg-white dark:bg-paperDark shrink-0" style={{ width: NAME_W, minWidth: NAME_W }} />
          {days.map((d, i) => {
            const today   = isToday(d)
            const dateStr = format(d, 'yyyy-MM-dd')
            const closed  = closedDays.includes(i) || closedDates?.has(dateStr)
            return (
              <div key={i}
                className={`shrink-0 pt-3 pb-2 px-1 text-center ${i < 6 ? 'border-r border-charcoal/6 dark:border-white/8' : ''}`}
                style={{ width: COL_W, minWidth: COL_W }}
              >
                <div className={`font-mono text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5 ${today ? 'text-accent' : closed ? 'text-charcoal/25 dark:text-white/25' : 'text-charcoal/40 dark:text-white/35'}`}>
                  {DAY_LABELS[i]}
                </div>
                {today ? (
                  <div className="w-7 h-7 rounded-full mx-auto flex items-center justify-center bg-brand">
                    <span className="text-body-sm font-bold text-white leading-none">{format(d, 'd')}</span>
                  </div>
                ) : (
                  <div className={`text-body-sm font-semibold leading-none ${closed ? 'text-charcoal/25 dark:text-white/25' : 'text-charcoal/80 dark:text-white/68'}`}>
                    {format(d, 'd')}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Staff rows */}
        {staff.map((s) => {
          const accent     = staffColour(s)
          const isOwnStaff = !isManager && currentStaffId === s.id
          const rowBg      = isOwnStaff ? 'bg-accent/4' : 'bg-white dark:bg-paperDark'
          return (
            <div key={s.id} className={`flex border-b border-charcoal/6 dark:border-white/8 ${rowBg}`}>
              {/* Name cell */}
              <div
                className={`sticky left-0 z-10 ${rowBg} shrink-0 pl-4 pr-3 py-3 flex items-center gap-2.5`}
                style={{ width: NAME_W, minWidth: NAME_W }}
              >
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Avatar name={s.name} id={s.id} colour={s.colour} photoUrl={s.photo_url} size="md" decorative />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                </div>
                <div className="min-w-0">
                  <div className="text-body-sm font-semibold text-charcoal dark:text-white truncate">{firstName(s.name)}</div>
                </div>
              </div>

              {/* Day cells */}
              {days.map((d, di) => {
                const dateStr   = format(d, 'yyyy-MM-dd')
                const closed    = closedDays.includes(di) || closedDates?.has(dateStr)
                const dayShifts = shiftIndex[`${s.id}:${dateStr}`] ?? []
                const unavail   = unavailability?.[`${s.id}:${dateStr}`]
                const isTimeOff = unavail?.type === 'time_off'
                const canClick  = isManager || (currentStaffId === s.id && dayShifts.length > 0)
                return (
                  <div key={di}
                    className={`shrink-0 px-1.5 py-2 ${di < 6 ? 'border-r border-charcoal/6 dark:border-white/8' : ''}`}
                    style={{ width: COL_W, minWidth: COL_W, minHeight: 64 }}
                  >
                    {closed ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="font-mono text-[9px] text-charcoal/25 dark:text-white/25 uppercase tracking-widest">—</span>
                      </div>
                    ) : isTimeOff && dayShifts.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="rounded-[8px] px-2 py-1 bg-charcoal/6 dark:bg-white/8">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-charcoal/40 dark:text-white/35">Leave</span>
                        </div>
                      </div>
                    ) : dayShifts.length > 0 ? (
                      dayShifts.map(sh => (
                        <MobileShiftCell key={sh.id} shift={sh} accent={accent}
                          onClick={canClick ? () => onCellClick(s, d, dayShifts) : undefined} />
                      ))
                    ) : (
                      <div
                        className="h-full flex items-center justify-center"
                        onClick={isManager ? () => onCellClick(s, d, []) : undefined}
                        style={{ cursor: isManager ? 'pointer' : 'default' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-charcoal/20 dark:bg-white/20 block" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Totals row */}
        <div className="flex border-t border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark">
          <div
            className="sticky left-0 z-10 bg-white dark:bg-paperDark shrink-0 pl-4 pr-3 py-3 font-mono text-[10px] font-semibold text-charcoal/40 dark:text-white/35 uppercase tracking-[0.08em] flex items-center"
            style={{ width: NAME_W, minWidth: NAME_W }}
          >Hours</div>
          {dayTotals.map((t, i) => (
            <div key={i}
              className={`shrink-0 py-3 px-1 text-center ${i < 6 ? 'border-r border-charcoal/6 dark:border-white/8' : ''}`}
              style={{ width: COL_W, minWidth: COL_W }}
            >
              <div className="font-semibold text-body-sm text-charcoal/80 dark:text-white/68 tabular-nums">{t.hours > 0 ? `${t.hours}h` : '—'}</div>
              {t.heads > 0 && (
                <div className="font-mono text-[10px] text-charcoal/40 dark:text-white/35 mt-0.5 uppercase tracking-[0.04em]">{t.heads} on</div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
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
            <th className="sticky left-0 bg-white dark:bg-paperDark w-36 text-left px-5 py-3 text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium border-b border-charcoal/8 dark:border-white/8 z-10">
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
            // Gather all shifts for this staff member across all rendered days
            const staffShifts = days.flatMap(d => shiftIndex[`${s.id}:${format(d, 'yyyy-MM-dd')}`] ?? [])
            const isUnder18   = s.is_under_18 ?? false
            const totalHrs    = staffShifts.reduce((acc, sh) => acc + paidShiftHours(sh.start_time, sh.end_time, isUnder18, breakDurationMins), 0)
            const rawHrs      = staffShifts.reduce((acc, sh) => acc + shiftDurationHours(sh.start_time, sh.end_time), 0)
            // Count how many shifts qualify for a break
            const breakCount  = staffShifts.filter(sh => {
              const raw = shiftDurationHours(sh.start_time, sh.end_time)
              return isUnder18 ? raw > 4.5 : raw > 6
            }).length
            const totalBreakMins = breakCount * (isUnder18 ? 30 : breakDurationMins)
            const wageCost    = totalHrs * (s.hourly_rate ?? 0)
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
                            className="h-10 flex flex-col items-center justify-center rounded border border-indigo-200/60 px-1 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,theme(colors.indigo.500/8%)_3px,theme(colors.indigo.500/8%)_6px)]"
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
                              className="h-7 flex items-center justify-center rounded bg-charcoal/8 dark:bg-white/8 border border-charcoal/15 dark:border-white/15 hover:bg-charcoal/12 dark:hover:bg-white/15 transition-colors cursor-pointer"
                            >
                              <span className="text-[8px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">Unavail</span>
                            </button>
                            {isManager && (
                              <button
                                onClick={() => onCellClick(s, d, dayShifts)}
                                className="h-6 flex items-center justify-center text-micro rounded border border-dashed border-charcoal/12 dark:border-white/15 hover:border-charcoal/25 dark:hover:border-white/25 text-charcoal/20 dark:text-white/20 hover:text-charcoal/40 dark:hover:text-white/35 transition-colors cursor-pointer"
                              >+</button>
                            )}
                          </div>
                        ) : isManager ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => onCellClick(s, d, dayShifts)}
                              className="h-7 flex items-center justify-center text-xs rounded border border-dashed border-charcoal/12 dark:border-white/15 hover:border-charcoal/25 dark:hover:border-white/25 text-charcoal/20 dark:text-white/20 hover:text-charcoal/40 dark:hover:text-white/35 transition-colors cursor-pointer"
                            >+</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleAvailability?.(s.id, d) }}
                              className="h-5 flex items-center justify-center text-[8px] tracking-wider uppercase rounded text-charcoal/20 dark:text-white/20 hover:text-charcoal/40 dark:hover:text-white/35 hover:bg-charcoal/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              avail
                            </button>
                          </div>
                        ) : isOwnStaff ? (
                          <div className="h-10 flex items-center justify-center text-charcoal/15 dark:text-white/15 text-xs rounded border border-dashed border-charcoal/8 dark:border-white/8">
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
                              className="h-4 flex items-center justify-center text-[7px] tracking-wider uppercase rounded text-charcoal/15 dark:text-white/15 hover:text-charcoal/40 dark:hover:text-white/35 hover:bg-charcoal/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
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
      <div className="px-5 py-10 text-center text-sm text-charcoal/35 dark:text-white/30 italic">
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
      {/* Mobile/tablet: frozen-column week grid (< 1024px) */}
      <div className="lg:hidden">
        <MobileWeekGrid {...sharedProps} />
      </div>

      {/* Desktop: full week table (≥ 1024px) */}
      <div className="hidden lg:block">
        <DesktopWeekTable {...sharedProps} weeklyTotal={weeklyTotal} />
      </div>
    </>
  )
}
