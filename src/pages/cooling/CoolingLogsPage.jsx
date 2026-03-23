import React, { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import TimeSelect from '../../components/ui/TimeSelect'
import DateRangePresets, { presetToDates } from '../../components/ui/DateRangePresets'
import {
  useCoolingLogs,
  useTodayCoolingLogs,
  isCoolingTempFail,
  COOLING_TARGET_TEMP,
  COOLING_METHODS,
} from '../../hooks/useCoolingLogs'

const TABS = ['log', 'history']

const EMPTY_FORM = {
  foodItem: '',
  startTemp: '',
  endTemp: '',
  coolingMethod: 'ambient',
  startTime: format(new Date(), 'HH:mm'),
  notes: '',
}

function PassBadge({ endTemp }) {
  if (endTemp === '' || isNaN(Number(endTemp))) return null
  const fail = isCoolingTempFail(endTemp)
  return (
    <span className={`text-[11px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full ${
      fail ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
    }`}>
      {fail ? `FAIL >8°C` : 'PASS ≤8°C'}
    </span>
  )
}

function LogRow({ log }) {
  const fail = isCoolingTempFail(log.end_temp, log.target_temp)
  const method = COOLING_METHODS.find(m => m.value === log.cooling_method)?.label ?? log.cooling_method
  return (
    <div className={`rounded-xl border p-4 ${fail ? 'border-danger/30 bg-danger/5' : 'border-charcoal/10 bg-white dark:bg-white/5 dark:border-white/10'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-charcoal dark:text-white truncate">{log.food_item}</p>
          <p className="text-[11px] text-charcoal/50 dark:text-white/40 mt-0.5">{method}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold font-mono text-charcoal dark:text-white">
            {log.start_temp}°C → <span className={fail ? 'text-danger' : 'text-success'}>{log.end_temp}°C</span>
          </p>
          <PassBadge endTemp={log.end_temp} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-charcoal/6 dark:border-white/8">
        <span className="text-[11px] text-charcoal/40 dark:text-white/35">
          {format(new Date(log.logged_at), 'd MMM, HH:mm')} · {log.logged_by_name ?? 'Staff'}
        </span>
        {log.notes && <span className="text-[11px] text-charcoal/40 dark:text-white/35 italic truncate max-w-[180px]">{log.notes}</span>}
      </div>
    </div>
  )
}

export default function CoolingLogsPage() {
  const { venueId } = useVenue()
  const { session } = useSession()
  const { addToast } = useToast()

  const [tab, setTab] = useState('log')
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const [preset, setPreset] = useState('today')
  const [dateFrom, setDateFrom] = useState(presetToDates('today').dateFrom)
  const [dateTo, setDateTo]     = useState(presetToDates('today').dateTo)

  const { logs: todayLogs, loading: todayLoading, reload: reloadToday } = useTodayCoolingLogs()
  const { logs: historyLogs, loading: historyLoading } = useCoolingLogs(
    tab === 'history' ? dateFrom : null,
    tab === 'history' ? dateTo   : null,
  )

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const endFail = form.endTemp !== '' && !isNaN(Number(form.endTemp)) && isCoolingTempFail(form.endTemp)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.foodItem.trim()) { addToast('Enter the food item name', 'error'); return }
    if (form.startTemp === '' || isNaN(Number(form.startTemp))) { addToast('Enter a valid start temperature', 'error'); return }
    if (form.endTemp   === '' || isNaN(Number(form.endTemp)))   { addToast('Enter a valid end temperature', 'error'); return }
    if (endFail && !form.notes.trim()) { addToast('Add a corrective action note for failed cooling', 'error'); return }

    setSubmitting(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const startedAt = new Date(`${today}T${form.startTime}:00`).toISOString()

    const { error } = await supabase.from('cooling_logs').insert({
      venue_id:       venueId,
      food_item:      form.foodItem.trim(),
      start_temp:     Number(form.startTemp),
      end_temp:       Number(form.endTemp),
      target_temp:    COOLING_TARGET_TEMP,
      cooling_method: form.coolingMethod,
      started_at:     startedAt,
      logged_by:      session?.staffId   ?? null,
      logged_by_name: session?.staffName ?? null,
      notes:          form.notes.trim() || null,
    })

    setSubmitting(false)
    if (error) { addToast(error.message, 'error'); return }
    addToast('Cooling log saved', 'success')
    setForm(EMPTY_FORM)
    reloadToday()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl text-brand dark:text-white tracking-tight">Cooling Logs</h1>
        <p className="text-sm text-charcoal/50 dark:text-white/40 mt-1">
          Record food cooling temperatures — target ≤8°C (UK food safety regs)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-charcoal/6 dark:bg-white/8 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t
                ? 'bg-white dark:bg-white/15 text-charcoal dark:text-white shadow-sm'
                : 'text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white'
            }`}>
            {t === 'log' ? 'Log Reading' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <div className="space-y-6">
          {/* Form */}
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-charcoal/10 dark:border-white/10 p-5 space-y-4">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">New Cooling Entry</p>

            {/* Food item */}
            <div>
              <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Food Item</label>
              <input
                type="text"
                value={form.foodItem}
                onChange={e => set('foodItem', e.target.value)}
                placeholder="e.g. Chicken stock, Beef bolognese"
                className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-accent dark:focus:border-accent"
              />
            </div>

            {/* Temps */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Start Temp (°C)</label>
                <input
                  type="number" step="0.1"
                  value={form.startTemp}
                  onChange={e => set('startTemp', e.target.value)}
                  placeholder="e.g. 75"
                  className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-accent dark:focus:border-accent font-mono"
                />
                <p className="text-[11px] text-charcoal/35 dark:text-white/30 mt-1">When cooling started</p>
              </div>
              <div>
                <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 flex items-center gap-2">
                  End Temp (°C) <PassBadge endTemp={form.endTemp} />
                </label>
                <input
                  type="number" step="0.1"
                  value={form.endTemp}
                  onChange={e => set('endTemp', e.target.value)}
                  placeholder="e.g. 6"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono outline-none transition-colors bg-white dark:bg-white/8 text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 ${
                    endFail
                      ? 'border-danger focus:border-danger bg-danger/5'
                      : 'border-charcoal/15 dark:border-white/15 focus:border-accent'
                  }`}
                />
                <p className="text-[11px] text-charcoal/35 dark:text-white/30 mt-1">Target ≤8°C</p>
              </div>
            </div>

            {/* Method + time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Cooling Method</label>
                <select
                  value={form.coolingMethod}
                  onChange={e => set('coolingMethod', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white outline-none focus:border-accent appearance-none"
                >
                  {COOLING_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Cooling Started At</label>
                <TimeSelect value={form.startTime} onChange={v => set('startTime', v)} />
              </div>
            </div>

            {/* Corrective note — required on fail */}
            {endFail && (
              <div className="rounded-xl bg-danger/8 border border-danger/20 p-3">
                <p className="text-xs font-semibold text-danger mb-2">
                  ⚠ Temperature above 8°C — corrective action required
                </p>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Describe what corrective action was taken (e.g. food discarded, returned to rapid chill)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-danger/30 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-danger resize-none"
                />
              </div>
            )}

            {/* Optional notes when passing */}
            {!endFail && (
              <div>
                <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Notes (optional)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Any additional notes"
                  className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-accent"
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-charcoal dark:bg-white text-cream dark:text-charcoal py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-charcoal/85 dark:hover:bg-white/85 transition-colors disabled:opacity-40"
            >
              {submitting ? 'Saving…' : 'Save Cooling Log'}
            </button>
          </div>

          {/* Today's logs */}
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold mb-3">Today's Logs</p>
            {todayLoading ? (
              <p className="text-sm text-charcoal/40 dark:text-white/35">Loading…</p>
            ) : todayLogs.length === 0 ? (
              <p className="text-sm text-charcoal/40 dark:text-white/35 italic">No cooling logs recorded today</p>
            ) : (
              <div className="space-y-3">
                {todayLogs.map(log => <LogRow key={log.id} log={log} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <DateRangePresets
            preset={preset} onPreset={setPreset}
            dateFrom={dateFrom} dateTo={dateTo}
            onDateChange={(k, v) => { if (k === 'dateFrom') setDateFrom(v); else setDateTo(v) }}
          />
          {historyLoading ? (
            <p className="text-sm text-charcoal/40 dark:text-white/35">Loading…</p>
          ) : historyLogs.length === 0 ? (
            <p className="text-sm text-charcoal/40 dark:text-white/35 italic">No cooling logs for this period</p>
          ) : (
            <div className="space-y-3">
              {historyLogs.map(log => <LogRow key={log.id} log={log} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
