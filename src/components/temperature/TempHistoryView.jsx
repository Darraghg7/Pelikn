/**
 * TempHistoryView — the History tab shared by the temperature-check pages:
 * range pills, a stats strip, and one card per day with AM/PM cells.
 *
 * matrix: { [itemId]: { [yyyy-MM-dd]: { am?: log, pm?: log } } }
 * statusOf(log, item) → 'ok' | 'explained' | 'bad'
 */
import React, { useMemo } from 'react'
import { format, subDays, eachDayOfInterval, parseISO, isWithinInterval } from 'date-fns'
import { isCheckRequired } from '../../lib/temperatureChecks'
import { CARD, TONE } from './TempPageParts'

export const HISTORY_RANGES = [
  { id: 1,  label: 'Today'   },
  { id: 7,  label: '7 days'  },
  { id: 30, label: '30 days' },
]

const PERIODS = ['am', 'pm']

// A period only counts as missed once it's over: today's AM after noon,
// today's PM never (the day isn't finished), any earlier day always.
export function isPeriodOver(dateStr, period, todayStr, now) {
  if (dateStr < todayStr) return true
  if (dateStr > todayStr) return false
  return period === 'am' && now.getHours() >= 12
}

// closedDays uses the settings index (Mon = 0); closures are date ranges
export function buildClosedDateSet({ dateFrom, dateTo, closedDays, closures }) {
  const out = new Set()
  const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) })
  for (const d of days) {
    const jsDay = d.getDay()
    const settingsDay = (jsDay + 6) % 7
    if (closedDays.includes(settingsDay)) {
      out.add(format(d, 'yyyy-MM-dd'))
      continue
    }
    for (const c of closures) {
      if (isWithinInterval(d, { start: parseISO(c.start_date), end: parseISO(c.end_date) })) {
        out.add(format(d, 'yyyy-MM-dd'))
        break
      }
    }
  }
  return out
}

export function historyDateFrom(range, now = new Date()) {
  return format(subDays(now, range - 1), 'yyyy-MM-dd')
}

export function HistoryRangePills({ range, onRange, ranges = HISTORY_RANGES }) {
  return (
    <div className="flex gap-2">
      {ranges.map(r => (
        <button
          key={r.id}
          type="button"
          onClick={() => onRange(r.id)}
          className={[
            'h-10 px-4 rounded-full border text-sm font-semibold transition-colors',
            range === r.id
              ? 'bg-brand border-brand text-white'
              : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/70 hover:border-ink4',
          ].join(' ')}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

const STAT_TONE = {
  good: 'text-good dark:text-[#7fd1a4]',
  bad:  'text-bad dark:text-[#f19a86]',
  warn: 'text-warn dark:text-[#e8b06a]',
}

/** Three-up stats card. stats: [{ value, label, tone: 'good' | 'bad' | 'warn' | null }] */
export function StatStrip({ stats }) {
  return (
    <div className={`grid grid-cols-3 ${CARD} divide-x divide-line dark:divide-white/10`}>
      {stats.map(s => (
        <div key={s.label} className="px-4 py-3 min-w-0">
          <p className={`font-mono text-2xl font-semibold truncate ${STAT_TONE[s.tone] ?? 'text-ink dark:text-white'}`}>{s.value}</p>
          <p className="text-sm text-ink3 dark:text-white/45">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// 98% stays "98%", 95.83 becomes "95.8%"
export function formatPct(value) {
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
}

const CELL_BASE = 'w-[4.5rem] sm:w-24 h-9 rounded-lg inline-flex items-center justify-center font-mono text-sm font-semibold'

export default function TempHistoryView({
  items,
  matrix,
  loading,
  range,
  onRange,
  closedSet = new Set(),
  statusOf,
  renderMissed,
  noteOf,
  safeLabel = 'In range',
  emptyText = 'Nothing set up yet.',
}) {
  const now      = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const dateFrom = historyDateFrom(range, now)

  // Newest first; closed days and days nothing was due (or logged) are skipped.
  const days = useMemo(() => {
    return eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(todayStr) })
      .reverse()
      .map(d => format(d, 'yyyy-MM-dd'))
      .filter(dateStr => {
        if (closedSet.has(dateStr)) return false
        return items.some(item =>
          matrix[item.id]?.[dateStr] ||
          PERIODS.some(p => isCheckRequired(item, parseISO(dateStr), p))
        )
      })
  }, [dateFrom, todayStr, closedSet, items, matrix])

  let readings = 0, safe = 0, excursions = 0, missed = 0
  for (const dateStr of days) {
    for (const item of items) {
      for (const p of PERIODS) {
        const log = matrix[item.id]?.[dateStr]?.[p]
        if (log) {
          readings++
          if (statusOf(log, item) === 'ok') safe++
          else excursions++
        } else if (isCheckRequired(item, parseISO(dateStr), p) && isPeriodOver(dateStr, p, todayStr, now)) {
          missed++
        }
      }
    }
  }

  const dayLabel = (dateStr) => {
    const base = format(parseISO(dateStr), 'EEE d MMM')
    if (dateStr === todayStr) return `Today · ${base}`
    if (dateStr === format(subDays(now, 1), 'yyyy-MM-dd')) return `Yesterday · ${base}`
    return base
  }

  const renderCell = (item, dateStr, period) => {
    const log = matrix[item.id]?.[dateStr]?.[period]
    if (log) {
      return (
        <span
          className={`${CELL_BASE} ${TONE[statusOf(log, item)]}`}
          title={`Logged ${format(new Date(log.logged_at), 'HH:mm')} by ${log.logged_by_name ?? 'Unknown'}`}
        >
          {Number(log.temperature).toFixed(1)}°
        </span>
      )
    }
    if (!isCheckRequired(item, parseISO(dateStr), period)) {
      return <span className={`${CELL_BASE} ${TONE.off}`} title="Not required">·</span>
    }
    if (!isPeriodOver(dateStr, period, todayStr, now)) {
      return <span className={`${CELL_BASE} ${TONE.pending}`}>–</span>
    }
    const missedCls = `${CELL_BASE} ${TONE.missed} font-sans text-xs`
    return renderMissed
      ? renderMissed(item, dateStr, period, missedCls)
      : <span className={missedCls}>Missed</span>
  }

  return (
    <div className="flex flex-col gap-4">
      <HistoryRangePills range={range} onRange={onRange} />

      {loading ? (
        <div className="py-12 text-center">
          <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 dark:border-white/15 border-t-charcoal animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink3 dark:text-white/40 py-12 text-center">{emptyText}</p>
      ) : (
        <>
          <StatStrip stats={[
            { value: readings ? formatPct((safe / readings) * 100) : '–', label: safeLabel, tone: 'good' },
            { value: excursions, label: excursions === 1 ? 'Excursion' : 'Excursions', tone: excursions ? 'bad' : null },
            { value: missed, label: 'Missed', tone: missed ? 'warn' : null },
          ]} />

          {days.length === 0 ? (
            <p className="text-sm text-ink3 dark:text-white/40 py-10 text-center">No checks were due in this period.</p>
          ) : days.map(dateStr => (
            <div key={dateStr} className={`${CARD} overflow-hidden`}>
              <div className="flex items-center gap-2 px-4 py-3 bg-cream dark:bg-white/5 border-b border-line dark:border-white/10">
                <p className="flex-1 min-w-0 text-sm font-semibold text-ink dark:text-white truncate">{dayLabel(dateStr)}</p>
                <span className="w-[4.5rem] sm:w-24 text-center text-xs font-semibold text-ink3 dark:text-white/45">AM</span>
                <span className="w-[4.5rem] sm:w-24 text-center text-xs font-semibold text-ink3 dark:text-white/45">PM</span>
              </div>
              <div className="divide-y divide-line dark:divide-white/10">
                {items.map(item => {
                  const notes = noteOf
                    ? PERIODS.map(p => matrix[item.id]?.[dateStr]?.[p]).filter(Boolean)
                        .filter(log => statusOf(log, item) !== 'ok')
                        .map(log => noteOf(log, item)).filter(Boolean)
                    : []
                  return (
                    <div key={item.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="flex-1 min-w-0 text-[15px] text-ink dark:text-white truncate">{item.name}</p>
                        {renderCell(item, dateStr, 'am')}
                        {renderCell(item, dateStr, 'pm')}
                      </div>
                      {notes.map((note, i) => (
                        <p key={i} className="mt-2 px-3 py-2 rounded-lg bg-badBg dark:bg-bad/20 text-sm text-ink2 dark:text-white/75">
                          <span className="font-semibold text-bad dark:text-[#f19a86]">Corrective action</span> · {note}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
