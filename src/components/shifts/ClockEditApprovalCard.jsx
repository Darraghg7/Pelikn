/**
 * ClockEditApprovalCard — shown to managers when staff have pending
 * hour-edit requests. Approve applies the change to clock_events;
 * Deny rejects it with an optional note.
 *
 * Usage: render anywhere in the manager UI (Timesheet page, Dashboard).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../ui/Toast'

function fmt(iso) {
  if (!iso) return '—'
  return format(new Date(iso), 'HH:mm')
}
function fmtDate(iso) {
  if (!iso) return '—'
  return format(new Date(iso), 'EEE d MMM')
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
        <p style={{ fontSize: 15, fontWeight: 700, color: '#0d1a14', marginBottom: 12 }}>
          Deny this request
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Reason for denying (optional — staff will see this)"
          rows={3}
          style={{
            width: '100%', borderRadius: 10, border: '1px solid #e4e6e2',
            padding: '10px 12px', fontSize: 14, color: '#0d1a14',
            resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 14,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 11, border: 'none',
              background: '#f3f3ef', color: '#76817b', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={async () => { setSaving(true); await onDeny(note); setSaving(false) }}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 11, border: 'none',
              background: '#b3331c', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
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
          <span style={{
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#76817b', fontWeight: 600,
          }}>
            Hour Edit Requests
          </span>
          <span style={{
            minWidth: 18, height: 18, borderRadius: 999,
            background: '#a85d12', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}>
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
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0d1a14' }}>
                {r.staff?.name ?? 'Staff member'}
              </span>
              <span style={{
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                fontSize: 10, color: '#b3b9b5', letterSpacing: '0.05em',
              }}>
                {fmtDate(r.requested_clock_in)}
              </span>
            </div>

            {/* Times: original → requested */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: r.reason ? 6 : 10, flexWrap: 'wrap' }}>
              {/* Original */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#b3b9b5' }}>Was</span>
                <span style={{
                  fontFamily: "'Geist Mono', ui-monospace, monospace",
                  fontSize: 12, color: '#76817b', textDecoration: 'line-through',
                }}>
                  {fmt(r.original_clock_in)} → {fmt(r.original_clock_out)}
                </span>
              </div>
              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b3b9b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              {/* Requested */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#76817b' }}>Wants</span>
                <span style={{
                  fontFamily: "'Geist Mono', ui-monospace, monospace",
                  fontSize: 12, fontWeight: 600, color: '#0d1a14',
                }}>
                  {fmt(r.requested_clock_in)} → {fmt(r.requested_clock_out)}
                  {r.break_minutes > 0 && (
                    <span style={{ fontWeight: 400, color: '#76817b' }}> · {r.break_minutes}m break</span>
                  )}
                </span>
              </div>
            </div>

            {/* Reason */}
            {r.reason && (
              <p style={{ fontSize: 12, color: '#76817b', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.4 }}>
                "{r.reason}"
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDenyTarget(r.id)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9,
                  border: '1px solid #e4e6e2', background: '#fff',
                  fontSize: 13, fontWeight: 500, color: '#76817b',
                  cursor: 'pointer',
                }}
              >
                Deny
              </button>
              <button
                onClick={() => approve(r.id)}
                style={{
                  flex: 2, padding: '9px 0', borderRadius: 9,
                  border: 'none', background: '#13362a',
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  cursor: 'pointer',
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
