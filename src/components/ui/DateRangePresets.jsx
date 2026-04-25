/**
 * DateRangePresets — reusable Today / 7 Days / 30 Days / Custom picker.
 *
 * Props:
 *   preset       — 'today' | '7d' | '30d' | 'custom'
 *   onPreset     — (preset: string) => void
 *   dateFrom     — ISO date string (yyyy-MM-dd), used when preset === 'custom'
 *   dateTo       — ISO date string (yyyy-MM-dd), used when preset === 'custom'
 *   onDateChange — ({ dateFrom, dateTo }) => void, called for custom date changes
 */
import React from 'react'

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: '7 Days' },
  { key: '30d',   label: '30 Days' },
  { key: 'custom', label: 'Custom' },
]

/** Returns { dateFrom, dateTo } ISO strings for a given preset key. */
export function presetToDates(key) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const today = fmt(now)

  if (key === 'today') return { dateFrom: today, dateTo: today }

  if (key === '7d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return { dateFrom: fmt(from), dateTo: today }
  }

  if (key === '30d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return { dateFrom: fmt(from), dateTo: today }
  }

  return { dateFrom: '', dateTo: '' }
}

const inputCls = [
  'px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/10',
  'bg-white dark:bg-white/5',
  'text-sm text-charcoal dark:text-white/80',
  'focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20',
].join(' ')

export default function DateRangePresets({ preset = 'today', onPreset, dateFrom = '', dateTo = '', onDateChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPreset?.(key)}
          className={[
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            preset === key
              ? 'bg-charcoal dark:bg-white/15 text-white dark:text-white border-charcoal dark:border-white/20'
              : 'bg-transparent text-charcoal/60 dark:text-white/40 border-charcoal/15 dark:border-white/10 hover:border-charcoal/30 dark:hover:border-white/25 hover:text-charcoal dark:hover:text-white/70',
          ].join(' ')}
        >
          {label}
        </button>
      ))}

      {preset === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateChange?.({ dateFrom: e.target.value, dateTo })}
            className={inputCls}
          />
          <span className="text-charcoal/40 dark:text-white/30 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateChange?.({ dateFrom, dateTo: e.target.value })}
            className={inputCls}
          />
        </div>
      )}
    </div>
  )
}
