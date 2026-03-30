import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFridges } from '../../hooks/useFridgeLogs'
import { useSession } from '../../contexts/SessionContext'
import { isTempOutOfRange } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import NumPad from '../../components/ui/NumPad'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

const EXCEEDANCE_REASONS = [
  { id: 'delivery',       label: 'Delivery / restocking',  icon: '📦', explained: true  },
  { id: 'defrost',        label: 'Defrost cycle',           icon: '🔄', explained: true  },
  { id: 'service_access', label: 'Busy service access',     icon: '👨‍🍳', explained: true  },
  { id: 'equipment',      label: 'Equipment concern',       icon: '🔧', explained: false },
  { id: 'other',          label: 'Other reason',            icon: '✏️', explained: false },
]

function nowDatetimeLocal() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

export default function FridgeLogFormPage() {
  const navigate = useNavigate()
  const toast    = useToast()
  const { venueId }         = useVenue()
  const { fridges, loading } = useFridges()
  const { session, isManager } = useSession()

  const [fridgeId, setFridgeId]     = useState('')
  const [temp, setTemp]             = useState('')
  const [reason, setReason]         = useState(null)
  const [comment, setComment]       = useState('')
  const [loggedAt, setLoggedAt]     = useState(nowDatetimeLocal())
  const [submitting, setSubmitting] = useState(false)

  const selectedFridge  = fridges.find((f) => f.id === fridgeId)
  const outOfRange      = selectedFridge && temp !== ''
    ? isTempOutOfRange(temp, selectedFridge.min_temp, selectedFridge.max_temp)
    : false

  const selectedReason  = EXCEEDANCE_REASONS.find(r => r.id === reason)
  const isExplained     = selectedReason?.explained ?? false
  const needsNote       = reason !== null && !isExplained
  const isPastEntry     = loggedAt < nowDatetimeLocal().slice(0, 16)

  const canSubmit = fridgeId && temp !== '' && (
    !outOfRange ||
    (reason !== null && (isExplained || comment.trim().length >= 5))
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)

    const ts           = new Date(loggedAt)
    const checkPeriod  = ts.getHours() < 12 ? 'am' : 'pm'
    const followUpDueAt = isExplained && !isPastEntry
      ? new Date(ts.getTime() + 30 * 60 * 1000).toISOString()
      : null

    const { error } = await supabase.from('fridge_temperature_logs').insert({
      fridge_id:         fridgeId,
      fridge_name:       selectedFridge?.name ?? '',
      temperature:       parseFloat(temp),
      logged_by:         session?.staffId,
      logged_by_name:    session?.staffName ?? 'Unknown',
      notes:             comment.trim() || null,
      logged_at:         ts.toISOString(),
      check_period:      checkPeriod,
      venue_id:          venueId,
      exceedance_reason: reason ?? null,
      follow_up_due_at:  followUpDueAt,
    })

    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast(isPastEntry ? 'Past reading logged ✓' : 'Temperature logged ✓')
    navigate('/fridge/history')
  }

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-6 max-w-xl">

      <div className="flex items-center gap-4">
        <Link to="/fridge" className="text-charcoal/40 hover:text-charcoal transition-colors text-lg">←</Link>
        <div>
          <h1 className="font-serif text-3xl text-brand">Log Temperature</h1>
          <p className="text-xs text-charcoal/40 mt-0.5">You can backdate entries if the check was done earlier</p>
        </div>
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
                onClick={() => { setFridgeId(f.id); setReason(null); setComment('') }}
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

        {/* Date / time — all users, defaults to now */}
        <div className="bg-white rounded-xl border border-charcoal/10 p-5">
          <SectionLabel>Date &amp; Time</SectionLabel>
          <input
            type="datetime-local"
            value={loggedAt}
            max={nowDatetimeLocal()}
            onChange={(e) => setLoggedAt(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          {isPastEntry && (
            <p className="text-xs text-charcoal/40 mt-2">
              📅 This will be logged as a past entry for {format(new Date(loggedAt), 'd MMM yyyy, HH:mm')}
            </p>
          )}
        </div>

        {/* Temperature + reason */}
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <SectionLabel>Temperature (°C)</SectionLabel>

            {/* Big display */}
            <div className={[
              'w-full rounded-2xl border py-5 flex items-center justify-center gap-1 transition-colors',
              !fridgeId          ? 'opacity-40 bg-charcoal/4 border-charcoal/10' :
              outOfRange         ? 'border-warning/40 bg-warning/5' :
                                   'border-charcoal/12 bg-cream/30',
            ].join(' ')}>
              <span className={[
                'font-mono text-5xl font-bold tracking-tight transition-colors',
                outOfRange ? 'text-warning' : temp ? 'text-charcoal' : 'text-charcoal/20',
              ].join(' ')}>
                {temp || '–'}
              </span>
              <span className="text-2xl text-charcoal/35 font-light ml-1 mt-1">°C</span>
            </div>

            {/* NumPad — only shown when a fridge is selected */}
            {fridgeId && (
              <NumPad
                value={temp}
                onChange={(v) => { setTemp(v); setReason(null); setComment('') }}
              />
            )}
          </div>

          {/* OOR: reason picker */}
          {outOfRange && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-warning">⚠</span>
                <p className="text-sm font-semibold text-charcoal">
                  Above safe range ({selectedFridge.min_temp}–{selectedFridge.max_temp}°C) — what's the reason?
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                {EXCEEDANCE_REASONS.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setReason(r.id); setComment('') }}
                    className={[
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all',
                      reason === r.id
                        ? r.explained ? 'bg-warning/15 border-warning/40 text-charcoal' : 'bg-danger/8 border-danger/25 text-charcoal'
                        : 'bg-white border-charcoal/12 text-charcoal/60 hover:border-charcoal/25 hover:text-charcoal',
                    ].join(' ')}
                  >
                    <span className="text-base leading-none">{r.icon}</span>
                    <span className="flex-1">{r.label}</span>
                    {r.explained && <span className="text-[10px] text-success font-bold tracking-wide">No penalty</span>}
                  </button>
                ))}
              </div>

              {reason && isExplained && (
                <div className="rounded-lg bg-success/8 border border-success/20 px-3 py-2.5 flex items-start gap-2">
                  <span className="text-success shrink-0 mt-0.5">✓</span>
                  <p className="text-xs text-charcoal">
                    <span className="font-medium">Explained exceedance — no compliance penalty.</span>
                    {' '}The reading is recorded honestly in the audit log.
                    {!isPastEntry && ' A 30-minute follow-up reminder will be set.'}
                  </p>
                </div>
              )}

              {reason && needsNote && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/40">
                    Corrective Action <span className="text-danger">*</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe the corrective action taken…"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-sm resize-none"
                  />
                  {comment.trim().length > 0 && comment.trim().length < 5 && (
                    <p className="text-xs text-danger/70">Please provide more detail</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* In-range optional notes */}
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
          {submitting ? 'Saving…' : isPastEntry ? `Save Past Reading (${format(new Date(loggedAt), 'd MMM, HH:mm')}) →` : 'Save Reading →'}
        </button>
      </form>
    </div>
  )
}
