/**
 * TimeSelect — reliable cross-browser/device time picker.
 * Replaces native <input type="time"> which has inconsistent UX on Android/iOS.
 * Renders two <select> elements: Hour (00–23) and Minute (00, 05, 10 … 55).
 *
 * Props:
 *   value     — HH:mm string, e.g. "09:00"
 *   onChange  — (newValue: string) => void, called with HH:mm
 *   className — extra classes on the wrapper div
 *   disabled  — optional boolean
 */
import React from 'react'

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const selectCls = [
  'flex-1 min-w-0 px-2 py-2.5 rounded-xl border border-charcoal/15',
  'bg-white dark:bg-white/5 dark:border-white/10',
  'text-sm font-mono text-center text-charcoal dark:text-white/80',
  'focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20',
  'appearance-none cursor-pointer',
].join(' ')

export default function TimeSelect({ value = '09:00', onChange, className = '', disabled = false }) {
  const [hh, mm] = (value || '09:00').split(':')

  const handleHour = (e) => {
    onChange?.(`${e.target.value}:${mm ?? '00'}`)
  }

  const handleMinute = (e) => {
    // Snap minute to nearest 5 if needed
    onChange?.(`${hh ?? '09'}:${e.target.value}`)
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select
        value={hh ?? '09'}
        onChange={handleHour}
        disabled={disabled}
        aria-label="Hour"
        className={selectCls}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <span className="text-charcoal/40 dark:text-white/30 font-mono text-sm select-none">:</span>

      <select
        value={(() => {
          // Round to nearest 5-minute slot
          const raw = parseInt(mm ?? '0', 10)
          return String(Math.round(raw / 5) * 5 % 60).padStart(2, '0')
        })()}
        onChange={handleMinute}
        disabled={disabled}
        aria-label="Minute"
        className={selectCls}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  )
}
