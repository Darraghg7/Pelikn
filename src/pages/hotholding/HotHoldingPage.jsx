/**
 * HotHoldingPage — twice-daily hot holding temperature checks.
 *
 * UK Food Safety Regulations: food held hot for service must be ≥63°C.
 * Venues should check AM and PM (two full rounds per day).
 *
 * Features:
 *   - AM / PM period selector (auto-defaults based on time of day)
 *   - Grid of hot holding items with temp inputs + pass/fail indicators
 *   - "Complete Check" submits all readings in one go
 *   - Today's AM ✓ / PM ✓ status grid
 *   - Manager: add/remove hot holding items
 *   - History with date range presets
 */
import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import DateRangePresets, { presetToDates } from '../../components/ui/DateRangePresets'
import {
  useHotHoldingItems,
  useHotHoldingTodayStatus,
  useHotHoldingLogs,
  isHotHoldingFail,
  HOT_HOLDING_MIN_TEMP,
} from '../../hooks/useHotHolding'
import { formatTemp, formatDateTime } from '../../lib/utils'

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function PassBadge({ pass }) {
  return pass
    ? <span className="text-[10px] font-semibold tracking-wider uppercase bg-success/10 text-success px-2 py-0.5 rounded-full">Pass</span>
    : <span className="text-[10px] font-semibold tracking-wider uppercase bg-danger/10 text-danger px-2 py-0.5 rounded-full">Fail</span>
}

function PeriodBadge({ done }) {
  return done
    ? <span className="text-[10px] font-semibold tracking-wider uppercase bg-success/10 text-success px-2.5 py-1 rounded-full">✓ Done</span>
    : <span className="text-[10px] font-semibold tracking-wider uppercase bg-charcoal/8 text-charcoal/45 px-2.5 py-1 rounded-full">Pending</span>
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function HotHoldingPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()

  const { items, loading: itemsLoading, reload: reloadItems } = useHotHoldingItems()
  const { status, loading: statusLoading, reload: reloadStatus } = useHotHoldingTodayStatus()

  const [tab, setTab] = useState('check')  // 'check' | 'history'
  const [period, setPeriod] = useState(() => new Date().getHours() < 12 ? 'am' : 'pm')

  // Per-item temperature readings
  const [readings, setReadings] = useState({})
  const [comments, setComments] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Reset readings when period changes
  useEffect(() => { setReadings({}); setComments({}) }, [period])

  // History date range
  const [preset, setPreset]         = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const { dateFrom, dateTo } = preset === 'custom'
    ? { dateFrom: customFrom, dateTo: customTo }
    : presetToDates(preset)

  const { logs: histLogs, loading: histLoading } = useHotHoldingLogs(dateFrom, dateTo)

  // Manager: add item
  const [newItemName, setNewItemName] = useState('')
  const [addingItem, setAddingItem]   = useState(false)

  const handleAddItem = async () => {
    if (!newItemName.trim()) return
    setAddingItem(true)
    const { error } = await supabase.from('hot_holding_items').insert({ venue_id: venueId, name: newItemName.trim() })
    setAddingItem(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Item added')
    setNewItemName('')
    reloadItems()
  }

  const handleRemoveItem = async (itemId) => {
    const { error } = await supabase.from('hot_holding_items').update({ is_active: false }).eq('id', itemId)
    if (error) { toast(error.message, 'error'); return }
    toast('Item removed')
    reloadItems()
  }

  // Submit all readings for this period
  const handleCompleteCheck = async () => {
    const itemsWithReadings = items.filter(item => readings[item.id] !== undefined && readings[item.id] !== '')
    if (itemsWithReadings.length === 0) { toast('Enter at least one temperature reading', 'error'); return }

    // Check all fails have comments
    const missingComment = itemsWithReadings.find(item => {
      const temp = parseFloat(readings[item.id])
      return isHotHoldingFail(temp) && !comments[item.id]?.trim()
    })
    if (missingComment) {
      toast(`Add a corrective action note for "${missingComment.name}"`, 'error')
      return
    }

    setSubmitting(true)
    const rows = itemsWithReadings.map(item => ({
      venue_id:       venueId,
      item_id:        item.id,
      item_name:      item.name,
      temperature:    parseFloat(readings[item.id]),
      check_period:   period,
      logged_by:      session?.staffId ?? null,
      logged_by_name: session?.staffName ?? 'Unknown',
      logged_at:      new Date().toISOString(),
      notes:          comments[item.id]?.trim() || null,
    }))

    const { error } = await supabase.from('hot_holding_logs').insert(rows)
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${period.toUpperCase()} check completed — ${rows.length} reading${rows.length === 1 ? '' : 's'} logged`)
    setReadings({})
    setComments({})
    reloadStatus()
  }

  const periodDone = period === 'am' ? status.am : status.pm

  return (
    <div className="flex flex-col gap-6">

      {/* Page header */}
      <div>
        <h1 className="font-serif text-3xl text-charcoal">Hot Holding</h1>
        <p className="text-sm text-charcoal/45 mt-1">
          Check food held hot for service twice daily. UK minimum: <strong>≥{HOT_HOLDING_MIN_TEMP}°C</strong>.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-charcoal/5 rounded-xl p-1 w-fit">
        {[['check', 'Today\'s Check'], ['history', 'History']].map(([key, label]) => (
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

      {tab === 'check' && (
        <>
          {/* Today's status */}
          {!statusLoading && (
            <div className="bg-white rounded-xl border border-charcoal/10 p-5">
              <SectionLabel>Today's Status</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {[['am', 'AM Check'], ['pm', 'PM Check']].map(([p, label]) => (
                  <div key={p} className={`rounded-xl border p-4 flex items-center justify-between ${
                    (p === 'am' ? status.am : status.pm)
                      ? 'border-success/25 bg-success/5'
                      : 'border-charcoal/10 bg-cream/30'
                  }`}>
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{label}</p>
                      <p className="text-[11px] text-charcoal/45 mt-0.5">
                        {p === 'am' ? status.amLogs?.length : status.pmLogs?.length} reading{(p === 'am' ? status.amLogs?.length : status.pmLogs?.length) === 1 ? '' : 's'}
                      </p>
                    </div>
                    <PeriodBadge done={p === 'am' ? status.am : status.pm} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period selector */}
          <div className="bg-white rounded-xl border border-charcoal/10 p-5">
            <SectionLabel>Check Period</SectionLabel>
            <div className="flex gap-2">
              {[['am', 'AM'], ['pm', 'PM']].map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={[
                    'flex-1 py-3 rounded-xl border text-sm font-semibold tracking-wide transition-all',
                    period === p
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/55 border-charcoal/15 hover:border-charcoal/30',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            {periodDone && (
              <div className="mt-3 px-4 py-3 rounded-xl bg-success/8 border border-success/20">
                <p className="text-sm text-success font-medium">
                  ✓ {period.toUpperCase()} check already completed today. You can log additional readings if needed.
                </p>
              </div>
            )}
          </div>

          {/* Readings grid */}
          {itemsLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
              <p className="text-sm text-charcoal/45 italic">
                No hot holding items configured yet.
                {isManager ? ' Add items below to get started.' : ' Ask your manager to add items.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-charcoal/10 p-5">
              <SectionLabel>{period.toUpperCase()} Readings</SectionLabel>
              <div className="flex flex-col gap-3">
                {items.map(item => {
                  const tempVal = readings[item.id] ?? ''
                  const hasTemp = tempVal !== '' && !isNaN(parseFloat(tempVal))
                  const fail    = hasTemp && isHotHoldingFail(parseFloat(tempVal))
                  return (
                    <div key={item.id} className={`p-4 rounded-xl border transition-all ${
                      hasTemp
                        ? fail
                          ? 'border-danger/30 bg-danger/4'
                          : 'border-success/25 bg-success/5'
                        : 'border-charcoal/10 bg-cream/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-charcoal">{item.name}</p>
                          {hasTemp && (
                            <p className={`text-[11px] mt-0.5 font-medium ${fail ? 'text-danger' : 'text-success'}`}>
                              {fail ? `↓ Below ${HOT_HOLDING_MIN_TEMP}°C — corrective action required` : `✓ Pass`}
                            </p>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          value={tempVal}
                          onChange={e => setReadings(r => ({ ...r, [item.id]: e.target.value }))}
                          placeholder="°C"
                          className={[
                            'w-24 shrink-0 px-3 py-2 rounded-xl border text-sm font-mono text-center focus:outline-none focus:ring-2',
                            fail
                              ? 'border-danger/30 bg-danger/5 text-danger focus:ring-danger/20'
                              : hasTemp
                                ? 'border-success/30 bg-success/5 text-success focus:ring-success/20'
                                : 'border-charcoal/15 bg-white text-charcoal focus:ring-charcoal/20',
                          ].join(' ')}
                        />
                        {hasTemp && <PassBadge pass={!fail} />}
                      </div>
                      {fail && (
                        <input
                          type="text"
                          value={comments[item.id] ?? ''}
                          onChange={e => setComments(c => ({ ...c, [item.id]: e.target.value }))}
                          placeholder="Corrective action taken (required)…"
                          className="w-full mt-3 px-3 py-2 rounded-xl border border-danger/30 bg-danger/5 text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-danger/20"
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleCompleteCheck}
                disabled={submitting || Object.values(readings).every(v => v === '')}
                className="w-full mt-4 py-3 rounded-xl bg-charcoal text-cream text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-charcoal/85 active:scale-[0.98] transition-all"
              >
                {submitting ? 'Saving…' : `Complete ${period.toUpperCase()} Check`}
              </button>
            </div>
          )}

          {/* Manager: add/remove items */}
          {isManager && (
            <div className="bg-white rounded-xl border border-charcoal/10 p-5">
              <SectionLabel>Manage Items</SectionLabel>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                  placeholder="Add item (e.g. Soup, Gravy, Lasagne)…"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-charcoal/15 bg-cream/40 text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
                <button
                  onClick={handleAddItem}
                  disabled={!newItemName.trim() || addingItem}
                  className="px-4 py-2.5 rounded-xl bg-charcoal text-cream text-sm font-semibold disabled:opacity-40 hover:bg-charcoal/85 transition-colors"
                >
                  Add
                </button>
              </div>
              {items.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-charcoal/8 bg-cream/20">
                      <span className="text-sm text-charcoal">{item.name}</span>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-[11px] text-charcoal/35 hover:text-danger transition-colors px-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <SectionLabel>All Readings</SectionLabel>
            <DateRangePresets
              preset={preset}
              onPreset={setPreset}
              dateFrom={customFrom}
              dateTo={customTo}
              onDateChange={({ dateFrom: df, dateTo: dt }) => { setCustomFrom(df); setCustomTo(dt) }}
            />
          </div>

          {histLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : histLogs.length === 0 ? (
            <p className="text-center text-sm text-charcoal/35 italic py-10">No records found. Try adjusting the date range.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-charcoal/8">
                    <th className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">Item</th>
                    <th className="text-center px-3 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">Period</th>
                    <th className="text-left px-4 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">Temp</th>
                    <th className="text-center px-3 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">Status</th>
                    <th className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium hidden sm:table-cell">By</th>
                    <th className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {histLogs.map(log => {
                    const fail = isHotHoldingFail(log.temperature)
                    return (
                      <tr key={log.id} className={`border-t border-charcoal/6 ${fail ? 'bg-danger/4' : ''}`}>
                        <td className="px-5 py-3 text-charcoal font-medium">{log.item_name}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-[10px] font-semibold tracking-wider uppercase text-charcoal/50">
                            {log.check_period?.toUpperCase()}
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
          )}
        </div>
      )}
    </div>
  )
}
