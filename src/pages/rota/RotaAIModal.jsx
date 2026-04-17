import React, { useState } from 'react'
import { format } from 'date-fns'
import Modal from '../../components/ui/Modal'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useRotaRequirements, DAY_NAMES } from '../../hooks/useRotaRequirements'
import { useToast } from '../../components/ui/Toast'
import { useSession } from '../../contexts/SessionContext'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">{children}</p>
}

const STAGES = { CONFIRM: 'confirm', LOADING: 'loading', PREVIEW: 'preview' }

export default function RotaAIModal({ open, onClose, weekStart, onSave }) {
  const toast                                     = useToast()
  const { session }                               = useSession()
  const { venueId }                               = useVenue()
  const { requirements, byDay, totalSlots, loading: reqLoading } = useRotaRequirements()

  const [stage, setStage]   = useState(STAGES.CONFIRM)
  const [result, setResult] = useState(null)   // { shifts, gaps, meta }
  const [saving, setSaving] = useState(false)
  const [mode, setMode]     = useState('fill_gaps') // 'fill_gaps' | 'rebuild'

  const weekLabel = weekStart ? format(weekStart, 'EEE d MMM yyyy') : ''
  const daysWithReqs = [1,2,3,4,5,6,7].filter(d => (byDay[d]?.length ?? 0) > 0)

  const handleGenerate = async () => {
    setStage(STAGES.LOADING)
    try {
      // Call the edge function directly via fetch so we can read the real
      // error body. supabase.functions.invoke consumes the response stream
      // internally, making the server's error message impossible to recover.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-rota`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          session_token: session?.token,
          venueId,
          weekStart:     format(weekStart, 'yyyy-MM-dd'),
        }),
      })
      const rawText = await res.text()
      let data
      try { data = JSON.parse(rawText) } catch { data = null }
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}: ${rawText.slice(0, 200)}`)
      }
      if (data?.error) throw new Error(data.error)
      setResult(data)
      setStage(STAGES.PREVIEW)
    } catch (e) {
      toast(e.message || 'Generation failed', 'error')
      setStage(STAGES.CONFIRM)
    }
  }

  const removeShift = (idx) => {
    setResult(r => ({ ...r, shifts: r.shifts.filter((_, i) => i !== idx) }))
  }

  const handleSave = async () => {
    if (!result?.shifts?.length) return
    setSaving(true)

    const shifts = result.shifts.map(s => ({
      staff_id:   s.staff_id,
      shift_date: s.shift_date,
      week_start: format(weekStart, 'yyyy-MM-dd'),
      start_time: s.start_time.length === 5 ? s.start_time + ':00' : s.start_time,
      end_time:   s.end_time.length   === 5 ? s.end_time   + ':00' : s.end_time,
      role_label: s.role_label,
      venue_id:   venueId,
    }))

    await onSave(shifts, mode === 'rebuild')
    setSaving(false)
    handleClose()
  }

  const handleClose = () => {
    setStage(STAGES.CONFIRM)
    setResult(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="✨ AI Rota Builder">
      <div className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto">

        {/* ── Stage: Confirm ── */}
        {stage === STAGES.CONFIRM && (
          <>
            <div className="rounded-xl bg-brand/6 border border-brand/12 px-5 py-4">
              <p className="text-sm font-medium text-charcoal mb-1">Week of {weekLabel}</p>
              {reqLoading ? (
                <p className="text-xs text-charcoal/40 animate-pulse">Loading requirements…</p>
              ) : requirements.length === 0 ? (
                <div className="flex items-start gap-2 mt-1">
                  <span className="text-warning shrink-0">⚠</span>
                  <p className="text-xs text-charcoal/60">
                    No requirements configured. Use <strong>Configure</strong> to tell the AI what staff you need each day.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-charcoal/50 mb-3">
                    {totalSlots} staff slot{totalSlots !== 1 ? 's' : ''} to fill across {daysWithReqs.length} day{daysWithReqs.length !== 1 ? 's' : ''}
                  </p>
                  {/* Per-day summary */}
                  <div className="flex flex-col gap-1.5">
                    {daysWithReqs.map(d => {
                      const slots   = byDay[d]
                      const total   = slots.reduce((a, s) => a + s.staff_count, 0)
                      const roles   = [...new Set(slots.map(s => s.role_name))].join(', ')
                      return (
                        <div key={d} className="flex items-start gap-2 text-xs">
                          <span className="font-medium text-charcoal w-24 shrink-0">
                            {DAY_NAMES[d - 1]}
                          </span>
                          <span className="text-charcoal/50">
                            {total} staff — {roles}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Mode selector */}
            <div>
              <SectionLabel>Mode</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'fill_gaps', label: 'Fill Gaps',  desc: 'Keep existing shifts, fill empty slots only' },
                  { value: 'rebuild',   label: 'Rebuild',     desc: 'Clear the week and rebuild from scratch' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={[
                      'p-3 rounded-xl border text-left transition-all',
                      mode === opt.value
                        ? 'bg-charcoal text-cream border-charcoal'
                        : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/30',
                    ].join(' ')}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className={`text-[11px] mt-0.5 ${mode === opt.value ? 'text-cream/60' : 'text-charcoal/35'}`}>
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={reqLoading || requirements.length === 0}
              className="bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>✨</span> Generate with AI
            </button>

            <p className="text-[11px] text-charcoal/30 text-center -mt-2">
              Takes 3–5 seconds · Checks availability, skills and fairness
            </p>
          </>
        )}

        {/* ── Stage: Loading ── */}
        {stage === STAGES.LOADING && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-10 h-10 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-charcoal">Generating your rota…</p>
              <p className="text-xs text-charcoal/40 mt-1">Checking availability, skills and hours distribution</p>
            </div>
          </div>
        )}

        {/* ── Stage: Preview ── */}
        {stage === STAGES.PREVIEW && result && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Shifts created', value: result.shifts.length },
                { label: 'Slots filled',   value: `${result.meta?.shiftsFilled ?? 0}/${result.meta?.slotsRequested ?? 0}` },
                { label: 'Gaps',           value: result.gaps?.length ?? 0, warn: (result.gaps?.length ?? 0) > 0 },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 text-center ${s.warn ? 'border-warning/30 bg-warning/6' : 'border-charcoal/10 bg-charcoal/2'}`}>
                  <p className={`font-serif text-2xl ${s.warn ? 'text-warning' : 'text-charcoal'}`}>{s.value}</p>
                  <p className="text-[10px] tracking-wider uppercase text-charcoal/35 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Gaps warning */}
            {result.gaps?.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/6 px-4 py-3 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-charcoal">
                  ⚠ {result.gaps.length} slot{result.gaps.length !== 1 ? 's' : ''} couldn't be filled
                </p>
                {result.gaps.map((g, i) => (
                  <p key={i} className="text-[11px] text-charcoal/60">
                    <span className="font-medium">{g.day_name} {g.shift_date}</span> — {g.role_label} {g.start_time}–{g.end_time}: {g.reason}
                  </p>
                ))}
              </div>
            )}

            {/* Shift list */}
            <div>
              <SectionLabel>Proposed shifts ({result.shifts.length}) — remove any you don't want</SectionLabel>
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {result.shifts.length === 0 ? (
                  <p className="text-sm text-charcoal/30 italic text-center py-4">No shifts generated.</p>
                ) : (
                  result.shifts.map((sh, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-charcoal/3 border border-charcoal/6">
                      <div>
                        <p className="text-xs font-medium text-charcoal">{sh.staff_name}</p>
                        <p className="text-[11px] text-charcoal/45">
                          {sh.shift_date} · {sh.start_time}–{sh.end_time} · {sh.role_label}
                        </p>
                      </div>
                      <button
                        onClick={() => removeShift(i)}
                        className="text-danger/40 hover:text-danger text-xs transition-colors px-2 py-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || result.shifts.length === 0}
                className="flex-1 bg-brand text-cream py-3 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : `Apply ${result.shifts.length} shift${result.shifts.length !== 1 ? 's' : ''} →`}
              </button>
              <button
                onClick={() => { setResult(null); setStage(STAGES.CONFIRM) }}
                className="px-4 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:text-charcoal transition-colors whitespace-nowrap"
              >
                Try again
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
