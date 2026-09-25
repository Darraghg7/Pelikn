/**
 * Shared building blocks for the temperature-check pages (fridge, hot holding):
 * header, tab bar, reading input, item settings rows, and status chips.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday } from 'date-fns'
import { TemperatureItemSettingsForm } from './TemperatureItemSettingsModal'

export const CARD = 'bg-white dark:bg-paperDark rounded-2xl border border-line dark:border-white/10'

// Status tones shared by chips, history cells and logged-reading blocks
export const TONE = {
  ok:        'bg-goodBg text-good dark:bg-good/20 dark:text-[#7fd1a4]',
  explained: 'bg-warnBg text-warn dark:bg-warn/20 dark:text-[#e8b06a]',
  bad:       'bg-badBg text-bad dark:bg-bad/25 dark:text-[#f19a86]',
  missed:    'bg-warnBg text-warn dark:bg-warn/20 dark:text-[#e8b06a]',
  pending:   'bg-cream text-ink4 dark:bg-white/5 dark:text-white/25',
  off:       'text-ink4 dark:text-white/20',
}

/** action: optional custom button to show instead of Export PDF */
export function PageHeader({ title, subtitle, backTo, backLabel = 'Checks', onExport, action, compact = false }) {
  return (
    <div className="flex flex-col gap-1">
      {/* On mobile the shell's back row already links to Checks */}
      {backTo && (
        <Link
          to={backTo}
          className="hidden self-start lg:inline-flex items-center gap-1 text-[15px] font-semibold text-brand dark:text-white/80 hover:opacity-75 transition-opacity"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          {backLabel}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className={`${compact ? 'text-[22px] sm:text-[26px]' : 'text-2xl min-[420px]:text-[26px] sm:text-[32px]'} leading-tight font-bold tracking-tight text-ink dark:text-white whitespace-nowrap`}>{title}</h1>
          {subtitle && <p className={`${compact ? 'text-[13px]' : 'text-[15px]'} text-ink3 dark:text-white/45 mt-0.5`}>{subtitle}</p>}
        </div>
        {action}
        {!action && onExport && (
          <button
            type="button"
            onClick={onExport}
            className="shrink-0 inline-flex items-center gap-2 h-11 px-3.5 sm:px-4 rounded-xl bg-white dark:bg-paperDark border border-line dark:border-white/10 text-sm sm:text-[15px] font-semibold text-ink2 dark:text-white/80 hover:border-ink4 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><polyline points="7 10 12 15 17 10" /><line x1="5" y1="20" x2="19" y2="20" /></svg>
            Export PDF
          </button>
        )}
      </div>
    </div>
  )
}

function CountBadge({ count, active, tone }) {
  return (
    <span className={[
      'min-w-[22px] h-[22px] px-1.5 rounded-full inline-flex items-center justify-center text-xs font-semibold tabular-nums',
      tone === 'bad' ? 'bg-bad text-white' : active ? 'bg-white/20 text-white' : 'bg-line2 dark:bg-white/10 text-ink2 dark:text-white/60',
    ].join(' ')}>
      {count}
    </span>
  )
}

/** tabs: [{ id, label, count?, countTone?: 'bad' }]; size 'sm' for the denser pages */
export function TabBar({ tabs, active, onChange, size = 'md' }) {
  const sm = size === 'sm'
  return (
    <div role="tablist" className={`${CARD} ${sm ? 'p-1' : 'p-1.5'} flex gap-1`}>
      {tabs.map(t => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={[
              // Grow from content width so a long label ("Today's check 3") never clips
              sm
                ? 'flex-auto h-9 px-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors'
                : 'flex-auto h-11 px-3 rounded-xl inline-flex items-center justify-center gap-2 text-sm min-[420px]:text-[15px] font-semibold whitespace-nowrap transition-colors',
              isActive ? 'bg-brand text-white' : 'text-ink2 dark:text-white/65 hover:text-ink dark:hover:text-white',
            ].join(' ')}
          >
            {t.label}
            {t.count ? <CountBadge count={t.count} active={isActive} tone={t.countTone} /> : null}
          </button>
        )
      })}
    </div>
  )
}

export function AddDashedButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-14 rounded-2xl border-[1.5px] border-dashed border-ink4/70 dark:border-white/20 text-[15px] font-semibold text-ink2 dark:text-white/70 inline-flex items-center justify-center gap-2 hover:border-ink3 hover:text-ink dark:hover:text-white transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      {label}
    </button>
  )
}

/** "AM 6.0°" / "PM –" pill. tone: a TONE key; value null renders a dash. */
export function PeriodChip({ period, value, tone = 'ok' }) {
  const cls = value === null ? 'bg-cream text-ink4 dark:bg-white/5 dark:text-white/30' : TONE[tone]
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full font-mono text-[13px] font-semibold ${cls}`}>
      <span>{period.toUpperCase()}</span>
      <span>{value === null ? '–' : value}</span>
    </span>
  )
}

/** Item name + "0–5°C · Wed–Sun" subline, with chips on the right. */
export function ItemHeading({ name, range, schedule, note, chips }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[17px] font-semibold text-ink dark:text-white truncate">{name}</p>
        <p className="text-sm text-ink3 dark:text-white/45 mt-0.5">
          <span className="font-mono text-ink2 dark:text-white/65">{range}</span>
          {' · '}{schedule}
          {note && ` · ${note}`}
        </p>
      </div>
      {chips && <div className="flex flex-wrap justify-end gap-1.5">{chips}</div>}
    </div>
  )
}

/** Temperature box with "°C" suffix and a Log button. */
export function ReadingInput({ value, onChange, onSubmit, placeholder, ariaLabel, canSubmit, saving, warn, autoFocus, submitLabel = 'Log' }) {
  return (
    <div className="flex gap-2.5">
      <div className="relative flex-1 min-w-0">
        <input
          type="number" step="0.1" min="-30" max="120"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (canSubmit) onSubmit() } }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={saving}
          autoFocus={autoFocus}
          autoComplete="off"
          inputMode="decimal"
          className={[
            'w-full h-12 pl-4 pr-11 rounded-xl border font-mono text-lg text-ink dark:text-white',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            'bg-cream dark:bg-white/5 placeholder:text-ink4 dark:placeholder:text-white/25',
            'focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-white/10 transition-colors',
            warn ? 'border-warning/50 focus:ring-warning/20' : 'border-line dark:border-white/10 focus:ring-brand/15 focus:border-brand/40',
            saving ? 'opacity-50' : '',
          ].join(' ')}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-base text-ink3 dark:text-white/40">°C</span>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || saving}
        className="h-12 px-4 min-w-[60px] rounded-xl bg-brand text-white text-[15px] font-semibold transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed"
      >
        {saving ? '…' : submitLabel}
      </button>
    </div>
  )
}

/** Tappable item row that expands into the settings form (manager setup tabs). */
export function ItemSettingsRow({ icon, name, subline, open, onToggle, formProps, onRemove }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
      >
        <span className="shrink-0 w-12 h-12 rounded-xl bg-brand-tint dark:bg-white/10 text-brand dark:text-white/80 inline-flex items-center justify-center">
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-semibold text-ink dark:text-white truncate">{name}</span>
          <span className="block text-sm text-ink3 dark:text-white/45 mt-0.5">{subline}</span>
        </span>
        <svg className={`w-5 h-5 shrink-0 text-ink3 dark:text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-1">
          <TemperatureItemSettingsForm
            {...formProps}
            onCancel={onToggle}
            secondaryAction={(
              <button
                type="button"
                onClick={onRemove}
                className="px-3 py-2 text-sm font-medium text-bad/80 hover:text-bad transition-colors"
              >
                Remove
              </button>
            )}
          />
        </div>
      )}
    </div>
  )
}

export const FRIDGE_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <line x1="5" y1="10" x2="19" y2="10" />
    <line x1="9" y1="5.5" x2="9" y2="7.5" />
    <line x1="9" y1="13" x2="9" y2="16" />
  </svg>
)

export const THERMOMETER_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V4.5a2 2 0 0 0-4 0v10.26a4 4 0 1 0 4 0Z" />
  </svg>
)

/* ── Form fields shared by the log-a-reading pages (cooking, cooling) ─────── */
export const FIELD_LABEL  = 'block text-[13px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
export const TEXT_FIELD   = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'
export const NUMBER_RESET = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/** "COOLING NOW ········ Target ≤8°C within 90 min" */
export function SectionHeading({ children, aside }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 -mb-1">
      <p className="text-[13px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">{children}</p>
      {aside && <p className="text-[13px] text-ink3 dark:text-white/45 text-right">{aside}</p>}
    </div>
  )
}

/** Tappable suggestions under a text box; the one matching `value` is highlighted. */
export function QuickPicks({ options, value, onPick }) {
  if (!options.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(name => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(name)}
          className={[
            'h-9 px-3.5 rounded-full border text-[15px] transition-colors',
            value.trim().toLowerCase() === name.toLowerCase()
              ? 'bg-brand-tint border-brand/40 text-brand dark:bg-white/10 dark:text-white dark:border-white/30'
              : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
          ].join(' ')}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

/** Labelled temperature box with a °C suffix. */
export function TempField({ label, value, onChange, placeholder, warn, ariaLabel }) {
  return (
    <label className="min-w-0">
      <span className={FIELD_LABEL}>{label}</span>
      <span className="relative block">
        <input
          type="number" step="0.1" min="-30" max="120" inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? label}
          className={`${TEXT_FIELD} ${NUMBER_RESET} pr-11 font-mono text-lg ${warn ? '!border-bad/50 !bg-badBg/40 text-bad' : ''}`}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-base text-ink3 dark:text-white/40">°C</span>
      </span>
    </label>
  )
}

/**
 * A time of day that defaults to now and keeps ticking until someone edits it.
 * A time later than now is taken as yesterday (e.g. logged just after midnight).
 */
export function useTimeOfDay() {
  const [time, setTimeState] = useState(() => format(new Date(), 'HH:mm'))
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched) return
    const id = setInterval(() => setTimeState(format(new Date(), 'HH:mm')), 30_000)
    return () => clearInterval(id)
  }, [touched])

  const at = useMemo(() => {
    const [hh, mm] = time.split(':').map(Number)
    const d = new Date()
    d.setHours(hh || 0, mm || 0, 0, 0)
    if (d.getTime() > Date.now() + 60_000) d.setDate(d.getDate() - 1)
    return d
  }, [time])

  return {
    time,
    at,
    dayLabel: isToday(at) ? 'Today' : 'Yesterday',
    setTime: (value) => { setTimeState(value); setTouched(true) },
    reset: () => { setTouched(false); setTimeState(format(new Date(), 'HH:mm')) },
  }
}

/** Time box with a clock icon and "Today"/"Yesterday"; pair with useTimeOfDay. */
export function TimeOfDayField({ label, clock }) {
  return (
    <label className="min-w-0">
      <span className={FIELD_LABEL}>{label}</span>
      <span className="relative block">
        <input
          type="time"
          value={clock.time}
          onChange={e => clock.setTime(e.target.value)}
          aria-label={label}
          className={`${TEXT_FIELD} pr-4 font-mono text-lg font-semibold [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full`}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 text-sm text-ink3 dark:text-white/45">
          <svg className="w-4 h-4 text-ink2 dark:text-white/65" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
          <span className="hidden min-[400px]:inline">{clock.dayLabel}</span>
        </span>
      </span>
    </label>
  )
}
