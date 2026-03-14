import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useFridges, useFridgeDashboard } from '../../hooks/useFridgeLogs'
import { useSession } from '../../contexts/SessionContext'
import { isTempOutOfRange, formatTemp, timeAgo } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import FridgeExportModal from './FridgeExportModal'

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function nowLocal() {
  const d = new Date()
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

export default function FridgeDashboardPage() {
  const toast = useToast()
  const { fridges, loading: fridgesLoading, reload: reloadFridges } = useFridges()
  const { data: dashData, loading: dashLoading, reload: reloadDash } = useFridgeDashboard()
  const { session, isManager } = useSession()

  // ── Log a reading ────────────────────────────────────────────────────────
  const [activeFridgeId, setActiveFridgeId] = useState('')
  const [temp, setTemp]       = useState('')
  const [comment, setComment] = useState('')
  const [loggedAt, setLoggedAt] = useState(nowLocal())
  const [submitting, setSubmitting] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const selectedFridge = fridges.find((f) => f.id === activeFridgeId)
  const outOfRange = selectedFridge && temp !== ''
    ? isTempOutOfRange(temp, selectedFridge.min_temp, selectedFridge.max_temp)
    : false
  const canSubmit = activeFridgeId && temp !== '' && (!outOfRange || comment.trim().length >= 5)

  const handleLog = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await supabase.from('fridge_temperature_logs').insert({
      fridge_id:      activeFridgeId,
      fridge_name:    selectedFridge?.name ?? '',
      temperature:    parseFloat(temp),
      logged_by:      session?.staffId,
      logged_by_name: session?.staffName ?? 'Unknown',
      notes:          comment.trim() || null,
      logged_at:      new Date(loggedAt).toISOString(),
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Temperature logged')
    setTemp('')
    setComment('')
    setLoggedAt(nowLocal())
    reloadDash()
  }

  // ── Manage fridges (manager only) ────────────────────────────────────────
  const [showManage, setShowManage] = useState(false)
  const [fridgeForm, setFridgeForm] = useState({ name: '', min_temp: '', max_temp: '' })
  const [savingFridge, setSavingFridge] = useState(false)

  const addFridge = async () => {
    if (!fridgeForm.name.trim()) { toast('Name is required', 'error'); return }
    const min = parseFloat(fridgeForm.min_temp)
    const max = parseFloat(fridgeForm.max_temp)
    if (isNaN(min) || isNaN(max)) { toast('Enter valid temperature ranges', 'error'); return }
    if (min >= max) { toast('Min must be less than max', 'error'); return }
    setSavingFridge(true)
    const { error } = await supabase.from('fridges').insert({
      name: fridgeForm.name.trim(), min_temp: min, max_temp: max,
    })
    setSavingFridge(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${fridgeForm.name.trim()} added`)
    setFridgeForm({ name: '', min_temp: '', max_temp: '' })
    reloadFridges()
    reloadDash()
  }

  const removeFridge = async (id, name) => {
    const { error } = await supabase.from('fridges').update({ is_active: false }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} removed`)
    reloadFridges()
    reloadDash()
  }

  if (fridgesLoading || dashLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Temperature Logs</h1>
        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={() => setShowManage(v => !v)}
              className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              {showManage ? 'Done' : 'Manage Fridges'}
            </button>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            Export PDF
          </button>
          <Link
            to="/fridge/history"
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            View History
          </Link>
        </div>
      </div>

      <FridgeExportModal open={showExport} onClose={() => setShowExport(false)} />

      {/* Manage Fridges panel */}
      {showManage && isManager && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-5">
          <SectionLabel>Manage Fridges &amp; Freezers</SectionLabel>

          {/* Add new */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-charcoal/60">Add new</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={fridgeForm.name}
                onChange={e => setFridgeForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name (e.g. Walk-in Fridge)"
                className="px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
              <input
                type="number" step="0.5"
                value={fridgeForm.min_temp}
                onChange={e => setFridgeForm(f => ({ ...f, min_temp: e.target.value }))}
                placeholder="Min °C"
                className="px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
              <input
                type="number" step="0.5"
                value={fridgeForm.max_temp}
                onChange={e => setFridgeForm(f => ({ ...f, max_temp: e.target.value }))}
                placeholder="Max °C"
                className="px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <button
              onClick={addFridge}
              disabled={savingFridge}
              className="self-start bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
            >
              {savingFridge ? 'Adding…' : '+ Add Fridge / Freezer'}
            </button>
          </div>

          {/* Existing list */}
          {fridges.length > 0 && (
            <div className="border-t border-charcoal/8 pt-4 flex flex-col divide-y divide-charcoal/6">
              {fridges.map(f => (
                <div key={f.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{f.name}</p>
                    <p className="text-xs text-charcoal/40">Safe range: {f.min_temp}°C to {f.max_temp}°C</p>
                  </div>
                  <button
                    onClick={() => removeFridge(f.id, f.name)}
                    className="text-xs text-charcoal/25 hover:text-danger transition-colors px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log a Reading */}
      {fridges.length > 0 && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <SectionLabel>Log a Reading</SectionLabel>

          {/* Fridge selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {fridges.map((f) => (
              <button
                key={f.id}
                onClick={() => { setActiveFridgeId(f.id); setTemp(''); setComment('') }}
                className={[
                  'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                  activeFridgeId === f.id
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/35',
                ].join(' ')}
              >
                {f.name}{' '}
                <span className="text-xs opacity-60">({f.min_temp}° to {f.max_temp}°)</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleLog} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">Temperature (°C)</p>
                <input
                  type="number" step="0.1" min="-30" max="60"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  placeholder="e.g. 2"
                  disabled={!activeFridgeId}
                  className={[
                    'w-full px-4 py-2.5 rounded-lg border bg-cream/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-charcoal placeholder-charcoal/25 text-sm transition-colors',
                    outOfRange ? 'border-danger/60 bg-danger/5' : 'border-charcoal/15',
                    !activeFridgeId ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                />
              </div>
              <div>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">Time of Check</p>
                <input
                  type="datetime-local"
                  value={loggedAt}
                  onChange={e => setLoggedAt(e.target.value)}
                  max={nowLocal()}
                  className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-sm text-charcoal"
                />
              </div>
            </div>

            {outOfRange && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-danger">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-danger">
                      Outside safe range ({selectedFridge.min_temp}–{selectedFridge.max_temp}°C)
                    </p>
                    <p className="text-xs text-danger/70 mt-0.5">A corrective action comment is required.</p>
                  </div>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Fridge door was left open — closed and will re-check in 30 minutes"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-sm resize-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="bg-charcoal text-cream px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed self-start"
            >
              {submitting ? '…' : 'Log Reading →'}
            </button>
          </form>
        </div>
      )}

      {/* Current Readings */}
      {dashData.length > 0 && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <SectionLabel>Current Readings</SectionLabel>
          <div className="flex flex-col divide-y divide-charcoal/6">
            {dashData.map((fridge) => {
              const log = fridge.lastLog
              const oor = log ? isTempOutOfRange(log.temperature, fridge.min_temp, fridge.max_temp) : false
              return (
                <div key={fridge.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${log ? (oor ? 'bg-danger' : 'bg-success') : 'bg-charcoal/20'}`} />
                    <div>
                      <p className="text-sm font-medium text-charcoal">{fridge.name}</p>
                      <p className="text-xs text-charcoal/40">Safe: {fridge.min_temp}–{fridge.max_temp}°C</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {log ? (
                      <>
                        <p className={`font-mono font-semibold text-lg ${oor ? 'text-danger' : 'text-charcoal'}`}>
                          {formatTemp(log.temperature)}
                        </p>
                        <p className="text-xs text-charcoal/40">{timeAgo(log.logged_at)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-charcoal/35 italic">No readings yet</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {fridges.length === 0 && !showManage && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
          <p className="text-charcoal/40 text-sm">No fridges set up yet.</p>
          {isManager && (
            <button
              onClick={() => setShowManage(true)}
              className="mt-3 text-xs text-charcoal/50 hover:text-charcoal underline underline-offset-2 transition-colors"
            >
              Add your first fridge →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
