/**
 * ClockEditApprovalCard — shown to managers when staff have pending
 * hour-edit requests. Approve applies the change to clock_events;
 * Deny rejects it with an optional note.
 *
 * Usage: render anywhere in the manager UI (Timesheet page, Dashboard).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../ui/Toast'
import { formatLondon } from '../../lib/time'

function fmt(iso) {
  if (!iso) return '—'
  return formatLondon(iso, 'HH:mm')
}
function fmtDate(iso) {
  if (!iso) return '—'
  return formatLondon(iso, 'EEE d MMM')
}

function DenySheet({ onDeny, onCancel }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px', width: '100%', maxWidth: 480,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[15px] font-bold text-charcoal" style={{ marginBottom: 12 }}>
          Deny this request
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Reason for denying (optional — staff will see this)"
          rows={3}
          className="text-sm text-charcoal resize-none outline-none w-full"
          style={{
            borderRadius: 10, border: '1px solid #e4e6e2',
            padding: '10px 12px', boxSizing: 'border-box', marginBottom: 14,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            className="text-sm font-medium cursor-pointer border-none"
            style={{
              flex: 1, padding: '12px 0', borderRadius: 11,
              background: '#f3f3ef', color: '#76817b',
            }}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={async () => { setSaving(true); await onDeny(note); setSaving(false) }}
            className="text-sm font-semibold text-white border-none disabled:opacity-60"
            style={{
              flex: 1, padding: '12px 0', borderRadius: 11,
              background: '#b3331c',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Denying…' : 'Deny'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClockEditApprovalCard({ compact = false }) {
  const { venueId }   = useVenue()
  const { session }   = useSession()
  const toast         = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [denyTarget, setDenyTarget] = useState(null) // request id

  const load = useCallback(() => {
    if (!venueId) return
    supabase
      .from('clock_edit_requests')
      .select(`
        id, status, created_at, reason,
        original_clock_in, original_clock_out,
        requested_clock_in, requested_clock_out, break_minutes,
        staff:staff_id ( name )
      `)
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRequests(data ?? []); setLoading(false) })
  }, [venueId])

  useEffect(() => { load() }, [load])

  const approve = async (id) => {
    const { error } = await supabase.rpc('approve_clock_edit_request', {
      p_request_id:  id,
      p_reviewer_id: session?.staffId,
    })
    if (error) { toast(error.message, 'error'); return }
    toast('Hours updated ✓')
    load()
  }

  const deny = async (id, note) => {
    const { error } = await supabase.rpc('deny_clock_edit_request', {
      p_request_id:  id,
      p_reviewer_id: session?.staffId,
      p_note:        note || null,
    })
    if (error) { toast(error.message, 'error'); return }
    toast('Request denied')
    setDenyTarget(null)
    load()
  }

  if (loading || requests.length === 0) return null

  return (
    <>
      <div style={{
        background: '#fff',
        border: '1px solid #e4e6e2',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 8px',
          borderBottom: '1px solid #eef0ec',
        }}>
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase font-semibold" style={{ color: '#76817b' }}>
            Hour Edit Requests
          </span>
          <span className="text-[11px] font-bold text-white flex items-center justify-center"
            style={{ minWidth: 18, height: 18, borderRadius: 999, background: '#a85d12', padding: '0 5px' }}
          >
            {requests.length}
          </span>
        </div>

        {/* Requests */}
        {requests.map((r, i) => (
          <div
            key={r.id}
            style={{
              padding: '12px 16px',
              borderBottom: i < requests.length - 1 ? '1px solid #eef0ec' : 'none',
            }}
          >
            {/* Staff name + date */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="text-sm font-semibold text-charcoal">
                {r.staff?.name ?? 'Staff member'}
              </span>
              <span className="font-mono text-[11px] tracking-[0.05em]" style={{ color: '#b3b9b5' }}>
                {fmtDate(r.requested_clock_in)}
              </span>
            </div>

            {/* Times: original → requested */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: r.reason ? 6 : 10, flexWrap: 'wrap' }}>
              {/* Original */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="text-[11px]" style={{ color: '#b3b9b5' }}>Was</span>
                <span className="font-mono text-xs line-through" style={{ color: '#76817b' }}>
                  {fmt(r.original_clock_in)} → {fmt(r.original_clock_out)}
                </span>
              </div>
              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b3b9b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              {/* Requested */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="text-[11px]" style={{ color: '#76817b' }}>Wants</span>
                <span className="font-mono text-xs font-semibold text-charcoal">
                  {fmt(r.requested_clock_in)} → {fmt(r.requested_clock_out)}
                  {r.break_minutes > 0 && (
                    <span className="font-normal" style={{ color: '#76817b' }}> · {r.break_minutes}m break</span>
                  )}
                </span>
              </div>
            </div>

            {/* Reason */}
            {r.reason && (
              <p className="text-xs italic" style={{ color: '#76817b', marginBottom: 10, lineHeight: 1.4 }}>
                "{r.reason}"
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDenyTarget(r.id)}
                className="text-[13px] font-medium cursor-pointer"
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9,
                  border: '1px solid #e4e6e2', background: '#fff',
                  color: '#76817b',
                }}
              >
                Deny
              </button>
              <button
                onClick={() => approve(r.id)}
                className="text-[13px] font-semibold text-white cursor-pointer border-none"
                style={{
                  flex: 2, padding: '9px 0', borderRadius: 9,
                  background: '#13362a',
                }}
              >
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>

      {denyTarget && (
        <DenySheet
          onDeny={(note) => deny(denyTarget, note)}
          onCancel={() => setDenyTarget(null)}
        />
      )}
    </>
  )
}
