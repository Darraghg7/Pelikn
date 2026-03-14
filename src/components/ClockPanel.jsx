/**
 * ClockPanel — inline clock-in/out/break widget for a single staff member.
 * Used on the My Shift dashboard.
 */
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useClockStatus } from '../hooks/useClockEvents'
import { useToast } from './ui/Toast'
import LoadingSpinner from './ui/LoadingSpinner'

const STATUS_CONFIG = {
  clocked_out: { label: 'Not Clocked In', color: 'text-charcoal/50', dot: 'bg-charcoal/25' },
  clocked_in:  { label: 'Clocked In',     color: 'text-success',     dot: 'bg-success'     },
  on_break:    { label: 'On Break',        color: 'text-warning',     dot: 'bg-warning'     },
}

export default function ClockPanel({ staffId, hasShift = true }) {
  const toast = useToast()
  const { status, loading, reload } = useClockStatus(staffId)
  const [submitting, setSubmitting] = useState(false)

  const record = async (eventType) => {
    setSubmitting(true)
    const { error } = await supabase.rpc('record_clock_event', {
      p_staff_id:   staffId,
      p_event_type: eventType,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast({ clock_in: 'Clocked in ✓', clock_out: 'Clocked out', break_start: 'Break started', break_end: 'Break ended ✓' }[eventType])
    reload()
  }

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.clocked_out

  if (loading) {
    return <div className="flex justify-center py-4"><LoadingSpinner /></div>
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Action buttons */}
      {status === 'clocked_out' && (
        hasShift ? (
          <button
            onClick={() => record('clock_in')}
            disabled={submitting}
            className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {submitting ? '…' : '▶ Clock In'}
          </button>
        ) : (
          <p className="text-xs text-charcoal/35 italic text-center py-2">No shift scheduled — clock in not available</p>
        )
      )}

      {status === 'clocked_in' && (
        <div className="flex gap-2">
          <button
            onClick={() => record('break_start')}
            disabled={submitting}
            className="flex-1 bg-warning/15 text-warning py-3 rounded-xl text-sm font-semibold hover:bg-warning/25 transition-colors disabled:opacity-40"
          >
            {submitting ? '…' : '☕ Break'}
          </button>
          <button
            onClick={() => record('clock_out')}
            disabled={submitting}
            className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {submitting ? '…' : '✓ Clock Out'}
          </button>
        </div>
      )}

      {status === 'on_break' && (
        <button
          onClick={() => record('break_end')}
          disabled={submitting}
          className="w-full bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {submitting ? '…' : '▶ End Break'}
        </button>
      )}
    </div>
  )
}
