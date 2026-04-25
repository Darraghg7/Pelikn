/**
 * CookingTempsPage — log cooking and reheating temperatures.
 *
 * UK Food Safety (Temperature Control) Regulations 1995:
 *   Cooking & reheating must reach a core temperature of ≥75°C.
 *
 * Features:
 *   - Tab: Cooking | Reheating
 *   - Form: food item, temperature, auto pass/fail, corrective note on fail
 *   - Today's log list below the form
 *   - History tab with date range presets
 */
import React, { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import DateRangePresets, { presetToDates } from '../../components/ui/DateRangePresets'
import { useCookingLogs, useTodayCookingLogs, isCookingTempFail, COOKING_TARGET_TEMP } from '../../hooks/useCookingLogs'
import { formatTemp, formatDateTime } from '../../lib/utils'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function PassBadge({ pass }) {
  return pass
    ? <span className="text-[11px] font-semibold tracking-wider uppercase bg-success/10 text-success px-2 py-0.5 rounded-full">Pass</span>
    : <span className="text-[11px] font-semibold tracking-wider uppercase bg-danger/10 text-danger px-2 py-0.5 rounded-full">Fail</span>
}

function nowLocal() {
  const d = new Date()
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

/* ── Log Form ─────────────────────────────────────────────────────────────── */
function LogForm({ checkType, onLogged }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()

  const [foodItem, setFoodItem] = useState('')
  const [temp, setTemp]         = useState('')
  const [comment, setComment]   = useState('')
  const [loggedAt, setLoggedAt] = useState(nowLocal())
  const [submitting, setSubmitting] = useState(false)

  const tempNum   = parseFloat(temp)
  const hasTemp   = temp !== '' && !isNaN(tempNum)
  const isFail    = hasTemp && isCookingTempFail(tempNum, COOKING_TARGET_TEMP)
  const canSubmit = foodItem.trim().length >= 2 && hasTemp && (!isFail || comment.trim().length >= 5)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await supabase.from('cooking_temp_logs').insert({
      venue_id:       venueId,
      check_type:     checkType,
      food_item:      foodItem.trim(),
      temperature:    tempNum,
      target_temp:    COOKING_TARGET_TEMP,
      logged_by:      session?.staffId ?? null,
      logged_by_name: session?.staffName ?? 'Unknown',
      logged_at:      new Date(loggedAt).toISOString(),
      notes:          comment.trim() || null,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Temperature logged')
    setFoodItem('')
    setTemp('')
    setComment('')
    setLoggedAt(nowLocal())
    onLogged?.()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Food item */}
      <div>
        <SectionLabel>Food Item</SectionLabel>
        <input
          type="text"
          value={foodItem}
          onChange={e => setFoodItem(e.target.value)}
          placeholder={checkType === 'cooking' ? 'e.g. Chicken breast, Beef burger…' : 'e.g. Lasagne, Soup, Curry…'}
          className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          required
        />
      </div>

      {/* Temperature + time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <SectionLabel>Core Temperature (°C)</SectionLabel>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={temp}
              onChange={e => setTemp(e.target.value)}
              placeholder="75.0"
              className={[
                'w-full px-4 py-3 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2',
                hasTemp
                  ? isFail
                    ? 'border-danger/40 bg-danger/4 text-danger focus:ring-danger/20'
                    : 'border-success/40 bg-success/5 text-success focus:ring-success/20'
                  : 'border-charcoal/15 bg-white text-charcoal focus:ring-charcoal/20',
              ].join(' ')}
            />
          </div>
          {hasTemp && (
            <p className={`text-[11px] mt-1.5 font-medium ${isFail ? 'text-danger' : 'text-success'}`}>
              {isFail
                ? `↓ Below ${COOKING_TARGET_TEMP}°C minimum — corrective action required`
                : <span className="inline-flex items-center gap-0.5"><svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> Above {COOKING_TARGET_TEMP}°C — pass</span>}
            </p>
          )}
        </div>
        <div>
          <SectionLabel>Date &amp; Time</SectionLabel>
          <input
            type="datetime-local"
            value={loggedAt}
            onChange={e => setLoggedAt(e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>
      </div>

      {/* Corrective note — required on fail */}
      {isFail && (
        <div>
          <SectionLabel>Corrective Action <span className="text-danger">*</span></SectionLabel>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Describe the corrective action taken (min 5 characters)…"
            rows={2}
            className="w-full px-4 py-3 rounded-xl border border-danger/30 bg-danger/4 text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-danger/20 resize-none"
          />
        </div>
      )}

      {/* Optional note when pass */}
      {!isFail && (
        <div>
          <SectionLabel>Notes (optional)</SectionLabel>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Any additional notes…"
            className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full py-3 rounded-xl bg-charcoal text-cream text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-charcoal/85 active:scale-[0.98] transition-all"
      >
        {submitting ? 'Logging…' : 'Log Temperature'}
      </button>
    </form>
  )
}

/* ── History table ────────────────────────────────────────────────────────── */
function HistoryTable({ logs, loading }) {
  if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>
  if (logs.length === 0) return (
    <p className="text-center text-sm text-charcoal/35 italic py-10">No records found. Try adjusting the date range.</p>
  )
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-t border-charcoal/8">
            <th className="text-left px-5 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">Food Item</th>
            <th className="text-left px-4 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">Type</th>
            <th className="text-left px-4 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">Temp</th>
            <th className="text-center px-3 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">Status</th>
            <th className="text-left px-5 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 font-medium hidden sm:table-cell">By</th>
            <th className="text-left px-5 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const fail = isCookingTempFail(log.temperature, log.target_temp ?? COOKING_TARGET_TEMP)
            return (
              <tr key={log.id} className={`border-t border-charcoal/6 ${fail ? 'bg-danger/4' : ''}`}>
                <td className="px-5 py-3 text-charcoal font-medium">{log.food_item}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] tracking-wider uppercase font-semibold text-charcoal/50 bg-charcoal/6 px-2 py-0.5 rounded-full">
                    {log.check_type}
                  </span>
                </td>
                <td className={`px-4 py-3 font-mono font-semibold ${fail ? 'text-danger' : 'text-charcoal'}`}>
                  {formatTemp(log.temperature)}
                </td>
                <td className="px-3 py-3 text-center">
                  <PassBadge pass={!fail} />
                </td>
                <td className="px-5 py-3 text-charcoal/60 hidden sm:table-cell">{log.logged_by_name ?? '—'}</td>
                <td className="px-5 py-3 text-charcoal/50 whitespace-nowrap text-xs">{formatDateTime(log.logged_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function CookingTempsPage() {
  const [tab, setTab]       = useState('log')        // 'log' | 'history'
  const [checkType, setCheckType] = useState('cooking')  // 'cooking' | 'reheating'
  const [logKey, setLogKey] = useState(0)            // bumped to reload today's list

  // History date range
  const [preset, setPreset]     = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const { dateFrom, dateTo } = preset === 'custom'
    ? { dateFrom: customFrom, dateTo: customTo }
    : presetToDates(preset)

  const { logs: histLogs, loading: histLoading } = useCookingLogs(null, dateFrom, dateTo)
  const { logs: todayLogs, loading: todayLoading, reload: reloadToday } = useTodayCookingLogs()

  const handlePreset = (key) => {
    setPreset(key)
  }

  const handleDateChange = ({ dateFrom: df, dateTo: dt }) => {
    setCustomFrom(df)
    setCustomTo(dt)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Cooking Temperatures</h1>
        <p className="text-sm text-charcoal/45 mt-1">
          Log core temperatures for cooking and reheating. UK minimum: <strong>≥{COOKING_TARGET_TEMP}°C</strong>.
        </p>
      </div>

      {/* Tab: Log / History */}
      <div className="flex gap-1 bg-charcoal/5 rounded-xl p-1 w-fit">
        {[['log', 'Log Reading'], ['history', 'History']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === key ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/50 hover:text-charcoal/75',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <>
          {/* Check type selector */}
          <div className="bg-white rounded-2xl border-charcoal/10 p-5">
            <SectionLabel>Check Type</SectionLabel>
            <div className="flex gap-2">
              {[['cooking', 'Cooking'], ['reheating', 'Reheating']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCheckType(key)}
                  className={[
                    'flex-1 py-3 rounded-xl border text-sm font-semibold tracking-wide transition-all',
                    checkType === key
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/55 border-charcoal/15 hover:border-charcoal/30',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            {checkType === 'reheating' && (
              <p className="text-[11px] text-charcoal/45 mt-3">
                Previously cooked food must be reheated to ≥75°C before serving.
              </p>
            )}
          </div>

          {/* Log form */}
          <div className="bg-white rounded-2xl border-charcoal/10 p-5">
            <SectionLabel>New Reading</SectionLabel>
            <LogForm
              key={`${checkType}-${logKey}`}
              checkType={checkType}
              onLogged={() => { setLogKey(k => k + 1); reloadToday() }}
            />
          </div>

          {/* Today's readings */}
          <div className="bg-white rounded-2xl border-charcoal/10 p-5">
            <SectionLabel>Today's Readings</SectionLabel>
            {todayLoading ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : todayLogs.length === 0 ? (
              <p className="text-sm text-charcoal/35 italic py-2">No readings logged today yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {todayLogs.map(log => {
                  const fail = isCookingTempFail(log.temperature, log.target_temp ?? COOKING_TARGET_TEMP)
                  return (
                    <div key={log.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${fail ? 'border-danger/25 bg-danger/4' : 'border-charcoal/8 bg-white'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{log.food_item}</p>
                        <p className="text-[11px] text-charcoal/45 mt-0.5">
                          <span className="uppercase tracking-wider">{log.check_type}</span>
                          {' · '}{log.logged_by_name}
                          {' · '}{formatDateTime(log.logged_at)}
                        </p>
                      </div>
                      <span className={`font-mono font-bold text-sm shrink-0 ${fail ? 'text-danger' : 'text-success'}`}>
                        {formatTemp(log.temperature)}
                      </span>
                      <PassBadge pass={!fail} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-2xl border-charcoal/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <SectionLabel>All Readings</SectionLabel>
            <DateRangePresets
              preset={preset}
              onPreset={handlePreset}
              dateFrom={customFrom}
              dateTo={customTo}
              onDateChange={handleDateChange}
            />
          </div>
          <HistoryTable logs={histLogs} loading={histLoading} />
        </div>
      )}
    </div>
  )
}
