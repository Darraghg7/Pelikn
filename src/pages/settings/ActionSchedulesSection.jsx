import React, { useState, useEffect } from 'react'
import Toggle from '../../components/ui/Toggle'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ACTION_ITEMS = [
  { key: 'opening_checks', label: 'Opening Checks',  description: 'Morning checklist before service' },
  { key: 'closing_checks', label: 'Closing Checks',  description: 'End-of-day checklist after service' },
  { key: 'fridge_checks',  label: 'Fridge Checks',   description: 'Temperature logs for fridges' },
  { key: 'cleaning_tasks', label: 'Cleaning Tasks',  description: 'Scheduled cleaning records' },
  { key: 'cooking_temps',  label: 'Cooking Temps',   description: 'Core temperature logging' },
  { key: 'hot_holding',    label: 'Hot Holding',     description: 'Hot holding temperature checks' },
  { key: 'cooling_logs',   label: 'Cooling Logs',    description: 'Cooling process records' },
]

export default function ActionSchedulesSection({ schedules, onSave }) {
  const [local, setLocal] = useState(schedules)

  useEffect(() => { setLocal(schedules) }, [schedules])

  const toggleEnabled = (key) => {
    const updated = { ...local, [key]: { ...local[key], enabled: !local[key].enabled } }
    setLocal(updated)
    onSave(updated)
  }

  const toggleDay = (key, day) => {
    const current = local[key].days
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort((a, b) => a - b)
    const updated = { ...local, [key]: { ...local[key], days: next } }
    setLocal(updated)
    onSave(updated)
  }

  return (
    <div className="flex flex-col gap-4">
      {ACTION_ITEMS.map(({ key, label, description }) => {
        const schedule = local[key] ?? { enabled: true, days: [0,1,2,3,4,5,6] }
        return (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-charcoal dark:text-white">{label}</p>
                <p className="text-xs text-charcoal/45 dark:text-white/45">{description}</p>
              </div>
              <Toggle checked={schedule.enabled} onChange={() => toggleEnabled(key)} size="sm" />
            </div>
            {schedule.enabled && (
              <div className="flex gap-1.5 flex-wrap pl-1">
                {DAY_LABELS.map((day, i) => {
                  const active = schedule.days.includes(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(key, i)}
                      className={[
                        'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                        active
                          ? 'bg-accent/10 text-accent border-accent/25'
                          : 'bg-charcoal/5 text-charcoal/35 border-charcoal/10',
                      ].join(' ')}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            )}
            {ACTION_ITEMS[ACTION_ITEMS.length - 1].key !== key && (
              <div className="border-t border-charcoal/8 mt-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}
