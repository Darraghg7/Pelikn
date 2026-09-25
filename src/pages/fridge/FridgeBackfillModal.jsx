import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { isTempOutOfRange, formatTemp } from '../../lib/utils'
import Modal from '../../components/ui/Modal'

const EXCEEDANCE_REASONS = [
  { id: 'delivery',       label: 'Delivery / restocking', explained: true  },
  { id: 'defrost',        label: 'Defrost cycle',         explained: true  },
  { id: 'service_access', label: 'Busy service access',   explained: true  },
  { id: 'equipment',      label: 'Equipment concern',     explained: false },
  { id: 'other',          label: 'Other reason',          explained: false },
]

/* ── Backfill record modal ────────────────────────────────────────────────── */
export default function FridgeBackfillModal({ open, onClose, fridge, dateStr, period, onSaved }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()

  const [temp, setTemp]       = useState('')
  const [time, setTime]       = useState(period === 'pm' ? '15:00' : '10:00')
  const [reason, setReason]   = useState(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving]   = useState(false)

  React.useEffect(() => {
    if (open) {
      setTemp('')
      setTime(period === 'pm' ? '15:00' : '10:00')
      setReason(null)
      setComment('')
    }
  }, [open, period])

  if (!fridge || !dateStr) return null

  const parsedTemp     = temp === '' ? null : parseFloat(temp)
  const outOfRange     = parsedTemp !== null && isTempOutOfRange(parsedTemp, fridge.min_temp, fridge.max_temp)
  const selectedReason = EXCEEDANCE_REASONS.find(r => r.id === reason)
  const isExplained    = selectedReason?.explained ?? false
  const needsNote      = reason !== null && !isExplained
  const canSave =
    parsedTemp !== null &&
    !Number.isNaN(parsedTemp) &&
    (!outOfRange || (reason !== null && (isExplained || comment.trim().length >= 5)))

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const [hh, mm] = time.split(':').map(Number)
    const dt = parseISO(dateStr)
    dt.setHours(hh ?? 12, mm ?? 0, 0, 0)

    const { error } = await supabase.from('fridge_temperature_logs').insert({
      fridge_id:         fridge.id,
      fridge_name:       fridge.name,
      temperature:       parsedTemp,
      logged_by:         session?.staffId,
      logged_by_name:    session?.staffName ?? 'Unknown',
      notes:             comment.trim() || null,
      logged_at:         dt.toISOString(),
      check_period:      period,
      venue_id:          venueId,
      exceedance_reason: reason ?? null,
      follow_up_due_at:  null,
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Saved ${formatTemp(parsedTemp)} for ${format(dt, 'd MMM')} ${period.toUpperCase()}`)
    onSaved()
    onClose()
  }

  const headerDate = format(parseISO(dateStr), 'EEEE, d MMM yyyy')

  return (
    <Modal open={open} onClose={onClose} title="Record missed reading">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 px-4 py-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">{period.toUpperCase()} check</p>
          <p className="text-sm font-semibold text-charcoal dark:text-white mt-0.5">{fridge.name}</p>
          <p className="text-xs text-charcoal/50 dark:text-white/40 mt-0.5">{headerDate}</p>
          <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5">Safe range: {fridge.min_temp}–{fridge.max_temp}°C</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1.5">Temperature (°C)</label>
            <input
              type="number" step="0.1" min="-30" max="60"
              value={temp}
              onChange={e => setTemp(e.target.value)}
              placeholder="e.g. 3.5"
              className={[
                'w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-paperDark focus:outline-none focus:ring-2',
                'text-lg font-mono text-charcoal dark:text-white placeholder-charcoal/20 dark:placeholder-white/15',
                outOfRange ? 'border-warning/50 focus:ring-warning/20' : 'border-charcoal/15 dark:border-white/15 focus:ring-charcoal/20 dark:focus:ring-white/20',
              ].join(' ')}
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1.5">Time taken</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
        </div>

        {outOfRange && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-warning">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <p className="text-xs font-semibold text-charcoal dark:text-white">Above safe range — what's the reason?</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {EXCEEDANCE_REASONS.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setReason(r.id); setComment('') }}
                  className={[
                    'flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all',
                    reason === r.id
                      ? r.explained
                        ? 'bg-warning/15 border-warning/40 text-charcoal dark:text-white'
                        : 'bg-danger/8 border-danger/25 text-charcoal dark:text-white'
                      : 'bg-white dark:bg-paperDark border-charcoal/12 dark:border-white/15 text-charcoal/60 dark:text-white/50 hover:border-charcoal/25 dark:hover:border-white/25 hover:text-charcoal dark:hover:text-white',
                  ].join(' ')}
                >
                  <span>{r.label}</span>
                  {r.explained && <span className="text-[11px] tracking-wide text-success font-semibold">No penalty</span>}
                </button>
              ))}
            </div>
            {reason && needsNote && (
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Describe the corrective action taken…"
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark focus:outline-none focus:ring-2 focus:ring-danger/20 text-sm resize-none"
              />
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!canSave || saving}
            className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Reading →'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/50 dark:text-white/40 hover:border-charcoal/30 dark:hover:border-white/30 transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-[11px] text-charcoal/35 dark:text-white/30 leading-relaxed">
          Backfilled readings are flagged in your audit log with the time you choose above and the staff member currently signed in.
        </p>
      </div>
    </Modal>
  )
}
