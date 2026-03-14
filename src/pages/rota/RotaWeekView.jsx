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
  currentStaffId = null,
  isManager = true,
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
              return (
                <th key={i} className={['px-3 py-3 border-b border-charcoal/8 text-center min-w-[96px]', today ? 'bg-accent/5' : ''].join(' ')}>
                  <p className={['text-[10px] tracking-widest font-medium', today ? 'text-accent' : 'text-charcoal/35'].join(' ')}>{DAY_LABELS[i]}</p>
                  <p className={['text-sm font-medium', today ? 'text-accent' : 'text-charcoal'].join(' ')}>{format(d, 'd MMM')}</p>
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
                  const dateStr  = format(d, 'yyyy-MM-dd')
                  const today    = isToday(d)
                  const dayShifts = shifts.filter((sh) => sh.staff_id === s.id && sh.shift_date === dateStr)
                  const canClick  = isManager || (isOwnStaff && dayShifts.length > 0)

                  return (
                    <td
                      key={di}
                      onClick={canClick ? () => onCellClick(s, d, dayShifts) : undefined}
                      className={[
                        'border-b border-charcoal/5 px-2 py-2 align-top transition-colors min-w-[96px]',
                        canClick ? 'cursor-pointer' : 'cursor-default',
                        today ? 'bg-accent/5' : '',
                        canClick && today  ? 'hover:bg-accent/10'  : '',
                        canClick && !today ? 'hover:bg-charcoal/5' : '',
                      ].join(' ')}
                    >
                      {dayShifts.length === 0 ? (
                        isManager ? (
                          <div className="h-10 flex items-center justify-center text-charcoal/20 text-xs rounded border border-dashed border-charcoal/12 hover:border-charcoal/25 transition-colors">
                            +
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
                              className={[
                                'rounded px-2 py-1.5 text-xs relative bg-charcoal text-cream',
                                isOwnStaff && !isManager
                                  ? 'ring-2 ring-accent ring-offset-1'
                                  : '',
                              ].join(' ')}
                            >
                              <p className="font-medium">{sh.start_time.slice(0,5)}&ndash;{sh.end_time.slice(0,5)}</p>
                              <p className="opacity-50 truncate text-[10px]">{sh.role_label}</p>
                              {isOwnStaff && !isManager && (
                                <span className="absolute -top-1 -right-1 bg-accent text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">
                                  ↔
                                </span>
                              )}
                            </div>
                          ))}
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
              <td colSpan={days.length + 1} className="px-5 py-3 text-right text-[10px] tracking-widests uppercase text-charcoal/40">
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
