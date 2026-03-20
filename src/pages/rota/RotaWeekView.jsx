import React from 'react'
import { format, isToday } from 'date-fns'
import { getWeekDays } from '../../lib/utils'
import { shiftDurationHours } from '../../hooks/useShifts'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function fmtGBP(amount) {
  return `£${Number(amount).toFixed(2)}`
}

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
    const hrs = staffShifts.reduce((acc, sh) => acc + shiftDurationHours(sh.start_time, sh.end_time), 0)
    return total + hrs * (s.hourly_rate ?? 0)
  }, 0)

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
            const totalHrs    = staffShifts.reduce((acc, sh) => acc + shiftDurationHours(sh.start_time, sh.end_time), 0)
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

                  // Closed days are not clickable
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
                        // Cell background
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
                        // ── Empty cell: availability state + add shift ──
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
                        // ── Has shifts ──
                        <div className="flex flex-col gap-1">
                          {dayShifts.map((sh) => (
                            <div
                              key={sh.id}
                              onClick={canClick ? () => onCellClick(s, d, dayShifts) : undefined}
                              className={[
                                'rounded px-2 py-1.5 text-xs relative bg-charcoal text-cream',
                                canClick ? 'cursor-pointer' : '',
                                isOwnStaff && !isManager
                                  ? 'ring-2 ring-accent ring-offset-1'
                                  : '',
                                // Warning if shift assigned to unavailable staff
                                unavail ? 'ring-2 ring-warning ring-offset-1' : '',
                              ].join(' ')}
                            >
                              <p className="font-medium">{sh.start_time.slice(0,5)}&ndash;{sh.end_time.slice(0,5)}</p>
                              <p className="opacity-50 truncate text-[10px]">{sh.role_label}</p>
                              {isOwnStaff && !isManager && (
                                <span className="absolute -top-1 -right-1 bg-accent text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">
                                  ↔
                                </span>
                              )}
                              {unavail && (
                                <span className="absolute -top-1 -left-1 bg-warning text-white text-[7px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">
                                  !
                                </span>
                              )}
                            </div>
                          ))}
                          {/* Inline availability toggle below shifts */}
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
                        <p className="text-[10px] text-charcoal/35">{totalHrs.toFixed(1)}h</p>
                      </div>
                    ) : (
                      <p className="text-charcoal/20 text-xs">—</p>
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
