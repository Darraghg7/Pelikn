import React from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay,
} from 'date-fns'
import { getRequestsForDay, initials } from './timeOffConstants'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const CHIP = {
  approved: 'bg-goodBg text-good dark:bg-good/20 dark:text-[#7fd1a4]',
  pending:  'bg-warnBg text-warn dark:bg-warn/20 dark:text-[#e8b06a]',
}

/**
 * Month grid. Each day shows who's off as initials chips (green = approved,
 * amber = pending); tapping a day selects it so the page can list who's off.
 */
export default function CalendarView({ month, requests, selected, onSelect, onPrev, onNext }) {
  const start = startOfMonth(month)
  const days  = eachDayOfInterval({ start, end: endOfMonth(month) })

  const startDow = getDay(start)
  const cells    = [...Array.from({ length: startDow === 0 ? 6 : startDow - 1 }, () => null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = startOfDay(new Date())

  return (
    <div className="bg-white dark:bg-paperDark rounded-2xl border border-line dark:border-white/10 px-3 sm:px-3.5 pt-2.5 pb-2.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <button type="button" onClick={onPrev} aria-label="Previous month" className="w-9 h-8 rounded-full inline-flex items-center justify-center text-ink2 dark:text-white/70 hover:bg-cream dark:hover:bg-white/10">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <p className="text-[15px] font-semibold text-ink dark:text-white">{format(month, 'MMMM yyyy')}</p>
        <button type="button" onClick={onNext} aria-label="Next month" className="w-9 h-8 rounded-full inline-flex items-center justify-center text-ink2 dark:text-white/70 hover:bg-cream dark:hover:bg-white/10">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_LETTERS.map((d, i) => (
          <div key={i} aria-label={DAY_NAMES[i]} className="text-center font-mono text-[13px] font-semibold text-ink3 dark:text-white/45 pb-2">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />
          const off        = getRequestsForDay(requests, day)
          const isToday    = isSameDay(day, today)
          const isPast     = isBefore(day, today)
          const isSelected = selected && isSameDay(day, selected)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={!!isSelected}
              aria-label={`${format(day, 'EEEE d MMMM')}${off.length ? `, ${off.length} off` : ''}`}
              className={`min-h-[46px] rounded-xl flex flex-col items-center gap-1 pt-1.5 pb-1 transition-colors ${isSelected ? 'bg-brand-tint dark:bg-white/10 ring-1 ring-brand/30' : 'hover:bg-cream dark:hover:bg-white/5'}`}
            >
              <span className={[
                'w-8 h-7 rounded-full inline-flex items-center justify-center text-[14px] font-medium',
                isToday ? 'bg-brand text-white font-semibold' : isPast ? 'text-ink4 dark:text-white/30' : 'text-ink dark:text-white',
              ].join(' ')}>
                {format(day, 'd')}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5 px-0.5">
                {off.slice(0, 2).map(r => (
                  <span
                    key={r.id}
                    title={`${r.staff?.name ?? 'Someone'} · ${r.status}`}
                    className={`min-w-[26px] h-[22px] px-1 rounded-full inline-flex items-center justify-center font-mono text-[11px] font-bold ${CHIP[r.status] ?? CHIP.approved}`}
                  >
                    {initials(r.staff?.name)}
                  </span>
                ))}
                {off.length > 2 && <span className="text-[11px] font-semibold text-ink3 dark:text-white/45">+{off.length - 2}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
