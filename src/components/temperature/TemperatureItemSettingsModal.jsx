import React, { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { CHECK_DAYS, CHECK_PERIODS, DEFAULT_CHECK_DAYS, DEFAULT_CHECK_PERIODS } from '../../lib/temperatureChecks'

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default function TemperatureItemSettingsModal({
  open,
  item,
  title,
  maxRequired = true,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    name: '',
    min_temp: '',
    max_temp: '',
    check_days: DEFAULT_CHECK_DAYS,
    required_periods: DEFAULT_CHECK_PERIODS,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item || !open) return
    setForm({
      name: item.name ?? '',
      min_temp: item.min_temp ?? '',
      max_temp: item.max_temp ?? '',
      check_days: Array.isArray(item.check_days) && item.check_days.length > 0 ? item.check_days : DEFAULT_CHECK_DAYS,
      required_periods: Array.isArray(item.required_periods) && item.required_periods.length > 0 ? item.required_periods : DEFAULT_CHECK_PERIODS,
    })
  }, [item, open])

  if (!item) return null

  const toggleDay = (day) => {
    setForm(current => {
      const hasDay = current.check_days.includes(day)
      const nextDays = hasDay
        ? current.check_days.filter(value => value !== day)
        : [...current.check_days, day]
      return { ...current, check_days: nextDays }
    })
  }

  const togglePeriod = (period) => {
    setForm(current => {
      const hasPeriod = current.required_periods.includes(period)
      const nextPeriods = hasPeriod
        ? current.required_periods.filter(value => value !== period)
        : [...current.required_periods, period]
      return { ...current, required_periods: nextPeriods }
    })
  }

  const handleSave = async () => {
    const min = toNumberOrNull(form.min_temp)
    const max = toNumberOrNull(form.max_temp)
    if (!form.name.trim()) return
    if (min === null) return
    if (maxRequired && max === null) return
    if (max !== null && min >= max) return
    if (form.check_days.length === 0 || form.required_periods.length === 0) return

    setSaving(true)
    await onSave({
      name: form.name.trim(),
      min_temp: min,
      max_temp: max,
      check_days: form.check_days.slice().sort((a, b) => a - b),
      required_periods: CHECK_PERIODS.map(p => p.value).filter(p => form.required_periods.includes(p)),
    })
    setSaving(false)
  }

  const min = toNumberOrNull(form.min_temp)
  const max = toNumberOrNull(form.max_temp)
  const canSave = form.name.trim() &&
    min !== null &&
    (!maxRequired || max !== null) &&
    (max === null || min < max) &&
    form.check_days.length > 0 &&
    form.required_periods.length > 0

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="sm:col-span-3">
            <span className="block text-[11px] tracking-widest uppercase text-charcoal/40 mb-1.5">Name</span>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </label>
          <label>
            <span className="block text-[11px] tracking-widest uppercase text-charcoal/40 mb-1.5">Safe min °C</span>
            <input
              type="number"
              step="0.1"
              value={form.min_temp}
              onChange={e => setForm(f => ({ ...f, min_temp: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </label>
          <label>
            <span className="block text-[11px] tracking-widest uppercase text-charcoal/40 mb-1.5">Safe max °C</span>
            <input
              type="number"
              step="0.1"
              value={form.max_temp ?? ''}
              onChange={e => setForm(f => ({ ...f, max_temp: e.target.value }))}
              placeholder={maxRequired ? '' : 'Optional'}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </label>
        </div>

        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Days to check</p>
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
            {CHECK_DAYS.map(day => {
              const active = form.check_days.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={[
                    'px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
                    active
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                  ].join(' ')}
                >
                  {day.short}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Required checks</p>
          <div className="grid grid-cols-2 gap-2">
            {CHECK_PERIODS.map(period => {
              const active = form.required_periods.includes(period.value)
              return (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => togglePeriod(period.value)}
                  className={[
                    'py-2.5 rounded-xl border text-sm font-semibold transition-all',
                    active
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                  ].join(' ')}
                >
                  {period.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-charcoal/15 text-sm font-medium text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-4 py-2 rounded-xl bg-charcoal text-cream text-sm font-semibold disabled:opacity-40 hover:bg-charcoal/85 transition-colors"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
