import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFridges } from '../../hooks/useFridgeLogs'
import { useSession } from '../../contexts/SessionContext'
import { isTempOutOfRange } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

export default function FridgeLogFormPage() {
  const navigate = useNavigate()
  const toast    = useToast()
  const { venueId } = useVenue()
  const { fridges, loading } = useFridges()
  const { session }          = useSession()

  const [fridgeId, setFridgeId]     = useState('')
  const [temp, setTemp]             = useState('')
  const [comment, setComment]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedFridge = fridges.find((f) => f.id === fridgeId)
  const outOfRange = selectedFridge && temp !== ''
    ? isTempOutOfRange(temp, selectedFridge.min_temp, selectedFridge.max_temp)
    : false

  const commentRequired = outOfRange
  const canSubmit = fridgeId && temp !== '' && (!commentRequired || comment.trim().length >= 5)

  const staffId   = session?.staffId
  const staffName = session?.staffName ?? 'Unknown'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await supabase.from('fridge_temperature_logs').insert({
      fridge_id:      fridgeId,
      fridge_name:    selectedFridge?.name ?? '',
      temperature:    parseFloat(temp),
      logged_by:      staffId,
      logged_by_name: staffName,
      notes:          comment.trim() || null,
      venue_id:       venueId,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Temperature logged ✓')
    navigate('/fridge')
  }

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-6 max-w-xl">

      <div className="flex items-center gap-4">
        <Link to="/fridge" className="text-charcoal/40 hover:text-charcoal transition-colors text-lg">←</Link>
        <h1 className="font-serif text-3xl text-brand">Log Temperature</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Fridge selector */}
        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <SectionLabel>Select Fridge / Zone</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {fridges.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setFridgeId(f.id); setComment('') }}
                className={[
                  'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                  fridgeId === f.id
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/35',
                ].join(' ')}
              >
                {f.name} <span className="opacity-60 text-xs">({f.min_temp}°–{f.max_temp}°)</span>
              </button>
            ))}
          </div>
        </div>

        {/* Temperature input */}
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-4">
          <div>
            <SectionLabel>Temperature (°C)</SectionLabel>
            <input
              type="number"
              step="0.1"
              min="-30"
              max="60"
              value={temp}
              onChange={(e) => { setTemp(e.target.value); setComment('') }}
              required
              placeholder="e.g. 3.5"
              disabled={!fridgeId}
              className={[
                'w-full px-4 py-3 rounded-lg border bg-cream/30 focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-2xl font-mono text-charcoal placeholder-charcoal/20 transition-colors',
                outOfRange ? 'border-danger/60 bg-danger/5' : 'border-charcoal/15',
                !fridgeId ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            />
          </div>

          {/* OOR mandatory comment */}
          {outOfRange && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <span className="text-danger mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-danger">
                    Reading outside safe range ({selectedFridge.min_temp}–{selectedFridge.max_temp}°C)
                  </p>
                  <p className="text-xs text-danger/70 mt-0.5">
                    A corrective action comment is required before you can save.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">
                  Corrective Action <span className="text-danger">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Fridge door was left open — closed and will re-check in 30 minutes"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-sm resize-none"
                />
                {comment.trim().length > 0 && comment.trim().length < 5 && (
                  <p className="text-xs text-danger/70 mt-1">Please provide more detail</p>
                )}
              </div>
            </div>
          )}

          {/* Non-OOR optional notes */}
          {!outOfRange && (
            <div>
              <SectionLabel>Notes (optional)</SectionLabel>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any observations…"
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-charcoal placeholder-charcoal/20 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-charcoal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save Reading →'}
        </button>
      </form>
    </div>
  )
}
