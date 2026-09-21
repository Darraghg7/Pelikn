import React from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isBefore,
} from 'date-fns'
import { getRequestsForDay } from './timeOffConstants'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarView({ month, requests, onDayClick }) {
  const start = startOfMonth(month)
  const end   = endOfMonth(month)
  const days  = eachDayOfInterval({ start, end })

  const startDow     = getDay(start)
  const mondayOffset = startDow === 0 ? 6 : startDow - 1
  const padBefore    = Array.from({ length: mondayOffset }, () => null)
  const allCells     = [...padBefore, ...days]
  while (allCells.length % 7 !== 0) allCells.push(null)

  const today = new Date()

  return (
    <div className="overflow-x-auto -mx-0">
      <div style={{ minWidth: '320px' }}>
        <div className="grid grid-cols-7 gap-px bg-charcoal/8 dark:bg-white/8 rounded-t-xl overflow-hidden">
          {DAY_LABELS.map(d => (
            <div key={d} className="bg-white dark:bg-paperDark py-2 text-center text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-charcoal/8 dark:bg-white/8 rounded-b-xl overflow-hidden">
          {allCells.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="bg-charcoal/3 dark:bg-white/5 min-h-[60px] sm:min-h-[72px]" />
            const dayRequests = getRequestsForDay(requests, day)
            const isToday     = isSameDay(day, today)
            const isPast      = isBefore(day, today) && !isToday
            return (
              <button
                key={i}
                onClick={() => onDayClick(day)}
                className={`bg-white dark:bg-paperDark min-h-[60px] sm:min-h-[72px] p-1 text-left transition-colors hover:bg-charcoal/3 dark:hover:bg-white/5 ${isPast ? 'opacity-50' : ''}`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday ? 'bg-charcoal text-cream' : 'text-charcoal/70 dark:text-white/60'
                }`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {dayRequests.slice(0, 2).map(r => (
                    <div
                      key={r.id}
                      className={`rounded px-1 py-0.5 text-[11px] sm:text-[11px] font-medium truncate ${
                        r.status === 'approved'
                          ? 'bg-success/15 text-success'
                          : r.status === 'pending'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-danger/10 text-danger/60 line-through'
                      }`}
                    >
                      {r.staff?.name?.split(' ')[0] ?? '?'}
                    </div>
                  ))}
                  {dayRequests.length > 2 && (
                    <span className="text-[11px] text-charcoal/30 dark:text-white/30">+{dayRequests.length - 2}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
