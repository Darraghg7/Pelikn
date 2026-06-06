import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── Design tokens ──────────────────────────────────────────────────────────────
const MC = {
  ink: '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line: '#e4e6e2', line2: '#eef0ec',
  bg: '#f3f3ef', paper: '#ffffff',
  brand: '#13362a', brandTint: '#eef4f0',
  good: '#1a7a4c', goodBg: '#e3f0e7',
  warn: '#a85d12', warnBg: '#fbeedc',
  bad:  '#b3331c', badBg:  '#fbeae6',
}
const MM = '"Geist Mono", ui-monospace, "SF Mono", monospace'
const MF = '"Geist", -apple-system, "SF Pro Text", system-ui, sans-serif'

const EMPLOYMENT_LABELS = {
  full_time:   'Full-time',
  part_time:   'Part-time',
  zero_hours:  'Zero hours',
  fixed_term:  'Fixed term',
}

// ── Staff card ──────────────────────────────────────────────────────────────────
function StaffCard({ member, recentAction, expiringDoc, onClick }) {
  const initials = member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: MC.paper, border: `1px solid ${MC.line}`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: MF,
      }}
    >
      {/* Avatar */}
      <span style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: MC.brandTint, color: MC.brand,
        display: 'grid', placeItems: 'center',
        fontFamily: MM, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
      }}>{initials}</span>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: MC.ink, letterSpacing: '-0.01em' }}>
          {member.name}
        </div>
        <div style={{ fontSize: 12, color: MC.ink3, marginTop: 2 }}>
          {member.job_role || 'No role set'}
          {member.employment_type && (
            <span style={{ marginLeft: 6, fontFamily: MM, fontSize: 10, color: MC.ink4 }}>
              · {EMPLOYMENT_LABELS[member.employment_type] ?? member.employment_type}
            </span>
          )}
        </div>
        {/* Status flags */}
        {(recentAction || expiringDoc) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {recentAction && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: MM, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', color: MC.bad,
                background: MC.badBg, borderRadius: 999, padding: '2px 7px',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                Formal action
              </span>
            )}
            {expiringDoc && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: MM, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', color: MC.warn,
                background: MC.warnBg, borderRadius: 999, padding: '2px 7px',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                Doc expiring
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chevron */}
      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={MC.ink4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M1 1l4 4-4 4"/>
      </svg>
    </button>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────────
export default function HRHubPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const vp = p => `/v/${venueSlug}${p}`

  const [staff,   setStaff]   = useState([])
  const [actions, setActions] = useState([]) // recent formal actions
  const [docs,    setDocs]    = useState([]) // expiring/expired docs
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) return
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const in30    = addDays(new Date(), 30).toISOString().slice(0, 10)
    const today   = new Date().toISOString().slice(0, 10)

    Promise.all([
      supabase.from('staff')
        .select('id, name, job_role, employment_type, is_active')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('name'),
      supabase.from('hr_formal_actions')
        .select('staff_id')
        .eq('venue_id', venueId)
        .gte('occurred_at', since90),
      supabase.from('staff_hr_documents')
        .select('staff_id, expiry_date')
        .eq('venue_id', venueId)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', in30),
    ]).then(([staffRes, actRes, docsRes]) => {
      setStaff(staffRes.data ?? [])
      setActions(actRes.data ?? [])
      setDocs(docsRes.data ?? [])
      setLoading(false)
    })
  }, [venueId])

  const actionStaffIds  = useMemo(() => new Set(actions.map(a => a.staff_id)), [actions])
  const expiringStaffIds = useMemo(() => new Set(docs.map(d => d.staff_id)), [docs])

  const sortedStaff = useMemo(() => [...staff].sort((a, b) => {
    // Put flagged staff first
    const aFlag = actionStaffIds.has(a.id) || expiringStaffIds.has(a.id)
    const bFlag = actionStaffIds.has(b.id) || expiringStaffIds.has(b.id)
    if (aFlag && !bFlag) return -1
    if (!aFlag && bFlag) return 1
    return a.name.localeCompare(b.name)
  }), [staff, actionStaffIds, expiringStaffIds])

  const flaggedCount = useMemo(
    () => staff.filter(s => actionStaffIds.has(s.id) || expiringStaffIds.has(s.id)).length,
    [staff, actionStaffIds, expiringStaffIds]
  )

  return (
    <div style={{ fontFamily: MF, padding: '16px 0 96px' }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <span style={{ fontFamily: MM, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: MC.ink3 }}>
          MANAGER · TEAM
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: MC.ink, lineHeight: 1.1, margin: '4px 0 0' }}>
          HR Records
        </h1>
      </div>

      {/* Summary strip */}
      {!loading && flaggedCount > 0 && (
        <div style={{
          background: MC.badBg, border: `1px solid ${MC.bad}25`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MC.bad} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ fontFamily: MM, fontSize: 11, fontWeight: 600, color: MC.bad }}>
            {flaggedCount} staff member{flaggedCount !== 1 ? 's' : ''} need{flaggedCount === 1 ? 's' : ''} attention
          </span>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
          <LoadingSpinner />
        </div>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: MC.ink4, fontSize: 14 }}>
          No active staff found.
        </div>
      ) : (
        <>
          <div style={{ fontFamily: MM, fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: MC.ink3, marginBottom: 8 }}>
            STAFF · {staff.length} active
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: MC.line, borderRadius: 14, overflow: 'hidden', border: `1px solid ${MC.line}` }}>
            {sortedStaff.map(s => (
              <StaffCard
                key={s.id}
                member={s}
                recentAction={actionStaffIds.has(s.id)}
                expiringDoc={expiringStaffIds.has(s.id)}
                onClick={() => navigate(vp(`/hr/${s.id}`))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
