import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useFridges, useFridgeHistory } from '../../hooks/useFridgeLogs'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { isTempOutOfRange, formatTemp, formatDateTime } from '../../lib/utils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import DateRangePresets, { presetToDates } from '../../components/ui/DateRangePresets'
import { useToast } from '../../components/ui/Toast'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-3">{children}</p>
}

const EXCEEDANCE_REASONS = [
  { id: 'delivery',       label: 'Delivery / restocking',  explained: true  },
  { id: 'defrost',        label: 'Defrost cycle',           explained: true  },
  { id: 'service_access', label: 'Busy service access',     explained: true  },
  { id: 'equipment',      label: 'Equipment concern',       explained: false },
  { id: 'other',          label: 'Other reason',            explained: false },
]

const REASON_LABELS = {
  delivery:       'Delivery',
  defrost:        'Defrost',
  service_access: 'Service access',
  equipment:      'Equipment',
  other:          'Other',
}

const EXCEEDANCE_ICONS = {
  delivery:       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  defrost:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  service_access: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  equipment:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>,
  other:          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
}

export default function FridgeHistoryPage() {
  const toast = useToast()
  const { isManager } = useSession()
  const { venueSlug } = useVenue()
  const { fridges } = useFridges()
  const [fridgeId, setFridgeId] = useState('')

  const [preset, setPreset]         = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const { dateFrom, dateTo } = preset === 'custom'
    ? { dateFrom: customFrom, dateTo: customTo }
    : presetToDates(preset)

  const { logs, loading, reload } = useFridgeHistory(fridgeId || null, dateFrom || null, dateTo || null)

  // Inline reason editing (manager only)
  const [editingId, setEditingId]   = useState(null)
  const [savingId, setSavingId]     = useState(null)

  const saveReason = async (logId, reason) => {
    setSavingId(logId)
    const { error } = await supabase
      .from('fridge_temperature_logs')
      .update({ exceedance_reason: reason })
      .eq('id', logId)
    setSavingId(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Reason updated — compliance score recalculated ✓')
    setEditingId(null)
    reload()
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center gap-4">
        <Link to={`/v/${venueSlug}/fridge`} className="text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white transition-colors text-lg">←</Link>
        <h1 className="text-2xl font-bold text-charcoal dark:text-white">Temperature History</h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 p-5 flex flex-wrap gap-4 items-end">
        <div>
          <SectionLabel>Fridge</SectionLabel>
          <select
            value={fridgeId}
            onChange={(e) => setFridgeId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          >
            <option value="">All fridges</option>
            {fridges.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <SectionLabel>Date Range</SectionLabel>
          <DateRangePresets
            preset={preset} onPreset={setPreset}
            dateFrom={customFrom} dateTo={customTo}
            onDateChange={({ dateFrom: df, dateTo: dt }) => { setCustomFrom(df); setCustomTo(dt) }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 overflow-hidden">
        <div className="px-5 pt-5 flex items-center justify-between">
          <SectionLabel>Readings</SectionLabel>
          {isManager && (
            <p className="text-[11px] text-charcoal/35 dark:text-white/30 mb-3">Tap a red reading to add a reason and fix the score</p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-sm text-charcoal/35 dark:text-white/30 italic py-10 pb-8">
            No readings found. Try adjusting your filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-charcoal/8 dark:border-white/8">
                  <th className="text-left px-5 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium">Fridge</th>
                  <th className="text-left px-5 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium">Temp</th>
                  <th className="text-center px-3 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium">AM/PM</th>
                  <th className="text-left px-5 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium hidden sm:table-cell">Logged by</th>
                  <th className="text-left px-5 py-2.5 text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium">Date / Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const min       = log.fridges?.min_temp ?? 0
                  const max       = log.fridges?.max_temp ?? 5
                  const oor       = isTempOutOfRange(log.temperature, min, max)
                  const explained = oor && log.exceedance_reason &&
                    ['delivery', 'defrost', 'service_access'].includes(log.exceedance_reason)
                  const isEditing = editingId === log.id
                  const isSaving  = savingId  === log.id

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        className={[
                          'border-t border-charcoal/6 dark:border-white/8',
                          oor && !explained ? 'bg-danger/4' : oor && explained ? 'bg-warning/4' : '',
                          isManager && oor && !isEditing ? 'cursor-pointer hover:bg-danger/8' : '',
                        ].join(' ')}
                        onClick={() => isManager && oor && !isEditing ? setEditingId(log.id) : null}
                      >
                        <td className="px-5 py-3 text-charcoal dark:text-white">{log.fridge_name}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-mono font-semibold ${
                              !oor ? 'text-charcoal dark:text-white' : explained ? 'text-warning' : 'text-danger'
                            }`}>
                              {formatTemp(log.temperature)}
                            </span>
                            {oor && (
                              <span className={`text-[11px] font-semibold tracking-wide px-1.5 py-0.5 rounded-full ${
                                explained ? 'bg-warning/15 text-warning' : 'bg-danger/12 text-danger'
                              }`}>
                                {log.exceedance_reason ? REASON_LABELS[log.exceedance_reason] : <span className="flex items-center gap-0.5"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> No reason</span>}
                              </span>
                            )}
                            {isManager && oor && !isEditing && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingId(log.id) }}
                                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                  explained
                                    ? 'border-charcoal/15 dark:border-white/15 text-charcoal/35 dark:text-white/30 hover:border-charcoal/30 dark:hover:border-white/30 hover:text-charcoal/60 dark:hover:text-white/50'
                                    : 'border-danger/25 text-danger/60 hover:border-danger/50 hover:text-danger'
                                }`}
                              >
                                {log.exceedance_reason ? 'Edit reason' : 'Add reason'}
                              </button>
                            )}
                          </div>
                          {log.notes && (
                            <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5 max-w-[220px] truncate">{log.notes}</p>
                          )}
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className="text-[11px] font-semibold tracking-wider uppercase text-charcoal/50 dark:text-white/40">
                            {log.check_period?.toUpperCase() ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-charcoal/60 dark:text-white/50 hidden sm:table-cell">{log.logged_by_name ?? '—'}</td>
                        <td className="px-5 py-3 text-charcoal/50 dark:text-white/40 whitespace-nowrap">{formatDateTime(log.logged_at)}</td>
                      </tr>

                      {/* Inline reason editor — expands below the row */}
                      {isEditing && (
                        <tr className="border-t-0">
                          <td colSpan={5} className="px-5 pb-4 pt-1 bg-charcoal/3 dark:bg-white/5">
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-semibold text-charcoal/60 dark:text-white/50">
                                Select a reason for this {formatTemp(log.temperature)} reading:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {EXCEEDANCE_REASONS.map(r => (
                                  <button
                                    key={r.id}
                                    disabled={isSaving}
                                    onClick={() => saveReason(log.id, r.id)}
                                    className={[
                                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                                      log.exceedance_reason === r.id
                                        ? 'bg-charcoal text-cream border-charcoal dark:border-white'
                                        : r.explained
                                          ? 'bg-success/8 border-success/25 text-charcoal dark:text-white hover:bg-success/15'
                                          : 'bg-danger/6 border-danger/20 text-charcoal dark:text-white hover:bg-danger/12',
                                      isSaving ? 'opacity-40 cursor-not-allowed' : '',
                                    ].join(' ')}
                                  >
                                    <span className="shrink-0 text-charcoal/50 dark:text-white/40">{EXCEEDANCE_ICONS[r.id]}</span>
                                    <span>{r.label}</span>
                                    {r.explained && <span className="text-[11px] text-success font-bold">NO PENALTY</span>}
                                  </button>
                                ))}
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-3 py-1.5 rounded-lg border border-charcoal/15 dark:border-white/15 text-xs text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                              {isSaving && <p className="text-[11px] text-charcoal/40 dark:text-white/35 animate-pulse">Saving…</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
