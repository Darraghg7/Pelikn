import React, { useState, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFridges, useTodayCheckStatus } from '../../hooks/useFridgeLogs'
import { useSession } from '../../contexts/SessionContext'
import { isTempOutOfRange, formatTemp } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import FridgeExportModal from './FridgeExportModal'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function nowLocal() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

/* ── Per-fridge inline card ───────────────────────────────────────────────── */
function FridgeCard({ fridge, session, venueId, onSaved }) {
  const toast = useToast()
  const [temp, setTemp]         = useState('')
  const [comment, setComment]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [savedLog, setSavedLog] = useState(null) // last saved reading for this card
  const commentRef = useRef(null)

  const outOfRange = temp !== '' && isTempOutOfRange(temp, fridge.min_temp, fridge.max_temp)
  const canSave    = temp !== '' && (!outOfRange || comment.trim().length >= 5)

  const save = useCallback(async () => {
    if (!canSave || saving) return
    setSaving(true)
    const now = new Date()
    const { data, error } = await supabase
      .from('fridge_temperature_logs')
      .insert({
        fridge_id:      fridge.id,
        fridge_name:    fridge.name,
        temperature:    parseFloat(temp),
        logged_by:      session?.staffId,
        logged_by_name: session?.staffName ?? 'Unknown',
        notes:          comment.trim() || null,
        logged_at:      now.toISOString(),
        check_period:   now.getHours() < 12 ? 'am' : 'pm',
        venue_id:       venueId,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setSavedLog({ temp: parseFloat(temp), outOfRange, time: now })
    setTemp('')
    setComment('')
    onSaved()
  }, [canSave, saving, temp, comment, fridge, session, venueId, outOfRange, onSaved, toast])

  const handleTempKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (outOfRange) {
        // Focus corrective action field
        setTimeout(() => commentRef.current?.focus(), 0)
      } else {
        save()
      }
    }
  }

  const handleTempBlur = () => {
    // Only auto-save on blur for in-range readings — out-of-range needs a comment first
    if (temp !== '' && !outOfRange) save()
  }

  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      save()
    }
  }

  const handleCommentBlur = () => {
    if (comment.trim().length >= 5) save()
  }

  const reset = () => {
    setSavedLog(null)
    setTemp('')
    setComment('')
  }

  return (
    <div className={[
      'bg-white rounded-xl border p-5 flex flex-col gap-3 transition-colors',
      savedLog
        ? savedLog.outOfRange
          ? 'border-danger/25 bg-danger/2'
          : 'border-success/30 bg-success/2'
        : outOfRange
          ? 'border-danger/30'
          : 'border-charcoal/10',
    ].join(' ')}>

      {/* Fridge name + range */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-charcoal text-sm">{fridge.name}</p>
          <p className="text-[11px] text-charcoal/35 mt-0.5">Safe: {fridge.min_temp}–{fridge.max_temp}°C</p>
        </div>
        {saving && (
          <span className="text-[11px] text-charcoal/30 animate-pulse">Saving…</span>
        )}
        {savedLog && !saving && (
          <span className={`text-[11px] font-semibold ${savedLog.outOfRange ? 'text-danger' : 'text-success'}`}>
            {savedLog.outOfRange ? '⚠ OOR saved' : '✓ Saved'}
          </span>
        )}
      </div>

      {/* If just saved — show confirmation + "Log another" */}
      {savedLog && !saving ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-2xl font-mono font-bold ${savedLog.outOfRange ? 'text-danger' : 'text-success'}`}>
              {formatTemp(savedLog.temp)}
            </p>
            <p className="text-[11px] text-charcoal/35 mt-0.5">
              {format(savedLog.time, 'HH:mm')} · {savedLog.time.getHours() < 12 ? 'AM' : 'PM'} check
            </p>
          </div>
          <button
            onClick={reset}
            className="text-xs text-charcoal/40 hover:text-charcoal border border-charcoal/15 hover:border-charcoal/30 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            + Log another
          </button>
        </div>
      ) : (
        <>
          {/* Temperature input */}
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/35 mb-1.5">
              Temperature (°C) — press Enter to save
            </p>
            <input
              type="number"
              step="0.1"
              min="-30"
              max="60"
              value={temp}
              onChange={(e) => { setTemp(e.target.value); setSavedLog(null) }}
              onKeyDown={handleTempKeyDown}
              onBlur={handleTempBlur}
              placeholder="e.g. 3.5"
              disabled={saving}
              autoComplete="off"
              inputMode="decimal"
              className={[
                'w-full px-4 py-3 rounded-lg border bg-cream/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20',
                'text-2xl font-mono text-charcoal placeholder-charcoal/20 transition-colors',
                outOfRange ? 'border-danger/50 bg-danger/4 focus:ring-danger/20' : 'border-charcoal/15',
                saving ? 'opacity-50' : '',
              ].join(' ')}
            />
          </div>

          {/* Out-of-range corrective action */}
          {outOfRange && (
            <div className="rounded-lg border border-danger/25 bg-danger/4 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-danger text-sm">⚠</span>
                <p className="text-xs font-semibold text-danger">
                  Outside safe range — corrective action required
                </p>
              </div>
              <textarea
                ref={commentRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                onBlur={handleCommentBlur}
                placeholder="e.g. Door left open — closed and will re-check in 30 minutes…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white focus:outline-none focus:ring-2 focus:ring-danger/20 text-sm resize-none"
              />
              <p className="text-[10px] text-charcoal/30">
                {comment.trim().length < 5
                  ? `${5 - comment.trim().length} more characters needed · Enter or tab away to save`
                  : 'Press Enter or tab away to save'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function FridgeDashboardPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { fridges, loading: fridgesLoading, reload: reloadFridges } = useFridges()
  const { status: checkStatus, loading: dashLoading, reload: reloadDash } = useTodayCheckStatus()
  const { session, isManager } = useSession()

  const [showManage, setShowManage] = useState(false)
  const [fridgeForm, setFridgeForm] = useState({ name: '', min_temp: '', max_temp: '' })
  const [savingFridge, setSavingFridge] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const addFridge = async () => {
    if (!fridgeForm.name.trim()) { toast('Name is required', 'error'); return }
    const min = parseFloat(fridgeForm.min_temp)
    const max = parseFloat(fridgeForm.max_temp)
    if (isNaN(min) || isNaN(max)) { toast('Enter valid temperature ranges', 'error'); return }
    if (min >= max) { toast('Min must be less than max', 'error'); return }
    setSavingFridge(true)
    const { error } = await supabase.from('fridges').insert({
      name: fridgeForm.name.trim(), min_temp: min, max_temp: max, venue_id: venueId,
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
        <h1 className="font-serif text-3xl text-brand">Temperature Logs</h1>
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
        </div>
      </div>

      <FridgeExportModal open={showExport} onClose={() => setShowExport(false)} />

      {/* Manage Fridges panel */}
      {showManage && isManager && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-5">
          <SectionLabel>Manage Fridges &amp; Freezers</SectionLabel>
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

      {/* ── Fridge cards — one per fridge, auto-save on Enter/blur ── */}
      {fridges.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fridges.map(fridge => (
            <FridgeCard
              key={fridge.id}
              fridge={fridge}
              session={session}
              venueId={venueId}
              onSaved={reloadDash}
            />
          ))}
        </div>
      ) : !showManage && (
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

      {/* Today's Checks — AM/PM Status Grid */}
      {checkStatus.length > 0 && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <SectionLabel>Today's Checks</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-widest uppercase text-charcoal/40">
                  <th className="text-left pb-3 font-medium">Fridge / Freezer</th>
                  <th className="text-center pb-3 font-medium w-24">AM</th>
                  <th className="text-center pb-3 font-medium w-24">PM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/6">
                {checkStatus.map(f => {
                  const renderCell = (log) => {
                    if (!log) return <span className="text-charcoal/25">—</span>
                    const oor = isTempOutOfRange(log.temperature, f.min_temp, f.max_temp)
                    return (
                      <span className={`font-mono font-semibold ${oor ? 'text-danger' : 'text-success'}`}>
                        {formatTemp(log.temperature)}
                      </span>
                    )
                  }
                  return (
                    <tr key={f.id}>
                      <td className="py-3">
                        <p className="font-medium text-charcoal">{f.name}</p>
                        <p className="text-[11px] text-charcoal/35">{f.min_temp}–{f.max_temp}°C</p>
                      </td>
                      <td className={`text-center py-3 ${f.am ? '' : 'bg-warning/5'}`}>
                        {renderCell(f.am)}
                      </td>
                      <td className={`text-center py-3 ${f.pm ? '' : 'bg-warning/5'}`}>
                        {renderCell(f.pm)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(() => {
            const total = checkStatus.length * 2
            const done  = checkStatus.filter(f => f.am).length + checkStatus.filter(f => f.pm).length
            return (
              <p className="text-[11px] text-charcoal/35 mt-3 pt-2 border-t border-charcoal/6">
                {done}/{total} checks completed today
              </p>
            )
          })()}
        </div>
      )}

    </div>
  )
}
