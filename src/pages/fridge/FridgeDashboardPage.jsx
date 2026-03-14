import React, { useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function FridgeDashboardPage() {
  const toast = useToast()
  const { fridges, loading: fridgesLoading } = useFridges()
  const { data: dashData, loading: dashLoading, reload } = useFridgeDashboard()
  const { session } = useSession()

  const [activeFridgeId, setActiveFridgeId] = useState('')
  const [temp, setTemp]                     = useState('')
  const [comment, setComment]               = useState('')
  const [submitting, setSubmitting]         = useState(false)
  const [showExport, setShowExport]         = useState(false)

  const selectedFridge = fridges.find((f) => f.id === activeFridgeId)
  const outOfRange = selectedFridge && temp !== ''
    ? isTempOutOfRange(temp, selectedFridge.min_temp, selectedFridge.max_temp)
    : false

  // When OOR, comment is required (min 5 chars)
  const commentRequired = outOfRange
  const canSubmit = activeFridgeId && temp !== '' && (!commentRequired || comment.trim().length >= 5)

  const handleLog = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const staffId   = session?.staffId
    const staffName = session?.staffName ?? 'Unknown'
    const { error } = await supabase.from('fridge_temperature_logs').insert({
      fridge_id:      activeFridgeId,
      fridge_name:    selectedFridge?.name ?? '',
      temperature:    parseFloat(temp),
      logged_by:      staffId,
      logged_by_name: staffName,
      notes:          comment.trim() || null,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Temperature logged')
    setTemp('')
    setComment('')
    reload()
  }

  if (fridgesLoading || dashLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Temperature Logs</h1>
        <div className="flex items-center gap-3">
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

      {/* Log a Reading */}
      {fridges.length > 0 && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <SectionLabel>Log a Reading</SectionLabel>

          {/* Fridge selector tabs */}
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
                <span className="text-xs opacity-60">
                  ({f.min_temp}° to {f.max_temp}°)
                </span>
              </button>
            ))}
          </div>

          {/* Temp input + log button */}
          <form onSubmit={handleLog} className="flex flex-col gap-3">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">
                Temperature (°C)
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="-30"
                  max="60"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  placeholder="e.g. 2"
                  disabled={!activeFridgeId}
                  className={[
                    'flex-1 px-4 py-2.5 rounded-lg border bg-cream/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-charcoal placeholder-charcoal/25 text-sm transition-colors',
                    outOfRange ? 'border-danger/60 bg-danger/5' : 'border-charcoal/15',
                    !activeFridgeId ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                />
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="bg-charcoal text-cream px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? '…' : 'Log →'}
                </button>
              </div>
            </div>

            {/* OOR warning + mandatory corrective action comment */}
            {outOfRange && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-danger mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-danger">
                      Reading outside safe range ({selectedFridge.min_temp}–{selectedFridge.max_temp}°C)
                    </p>
                    <p className="text-xs text-danger/70 mt-0.5">
                      You must enter a corrective action comment before saving.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">
                    Corrective Action <span className="text-danger">*</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="e.g. Fridge door was left open — closed and will re-check in 30 minutes"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-charcoal placeholder-charcoal/25 text-sm resize-none"
                  />
                  {comment.trim().length > 0 && comment.trim().length < 5 && (
                    <p className="text-xs text-danger/70 mt-1">Please provide more detail (min 5 characters)</p>
                  )}
                </div>
              </div>
            )}
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
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${oor ? 'bg-danger' : 'bg-success'}`} />
                    <div>
                      <p className="text-sm font-medium text-charcoal">{fridge.name}</p>
                      <p className="text-xs text-charcoal/40">
                        Safe: {fridge.min_temp}–{fridge.max_temp}°C
                      </p>
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

      {fridges.length === 0 && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
          <p className="text-charcoal/40 text-sm">No fridges set up yet.</p>
          <p className="text-charcoal/30 text-xs mt-1">Ask your manager to add fridges in Settings.</p>
        </div>
      )}
    </div>
  )
}
