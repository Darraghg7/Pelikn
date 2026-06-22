/**
 * HRHubPage.jsx — Workspace layout (sticky list left + employee record right).
 * Default layout per design handoff: two-pane master-detail, no page navigation on
 * staff selection. EmployeeRecordPage handles direct /hr/:id URL access.
 */
import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmployeeRecordPanel, { MC, MM, MF, Avatar, nameInitials } from './EmployeeRecordPanel'

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, tone, icon }) {
  return (
    <div style={{
      background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 16,
      padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 2,
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(13,26,20,0.03)',
    }}>
      {tone && (
        <span style={{
          position: 'absolute', left: 0, top: 14, bottom: 14, width: 3,
          borderRadius: '0 3px 3px 0', background: tone.fg,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MM, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: MC.ink3, fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ marginLeft: 'auto', color: tone ? tone.fg : MC.ink4, display: 'inline-flex' }}>
          {icon}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontFamily: MM, fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em',
          color: tone ? tone.fg : MC.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: MC.ink3 }}>{sub}</span>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICO = {
  users:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg>,
  alert:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  clock:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  gavel:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 13l-7.5 7.5a2.12 2.12 0 01-3-3L11 10"/><path d="M9 8l6 6"/><path d="M14.5 5.5l4 4"/><path d="M11 3l10 10"/></svg>,
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
}

// ── Workspace list row ────────────────────────────────────────────────────────
function ListRow({ s, selected, actionIds, expiringIds, onClick }) {
  const [hovered, setHovered] = useState(false)
  const isSel  = selected?.id === s.id
  const dotCol = actionIds.has(s.id)   ? MC.bad  :
                 expiringIds.has(s.id) ? MC.warn : null

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
        cursor: 'pointer', padding: '10px 13px', borderRadius: 12,
        border: '1px solid transparent', fontFamily: MF,
        background: isSel ? MC.brandTint : hovered ? MC.line2 : 'transparent',
        transition: 'background .12s',
      }}
    >
      <Avatar name={s.name} size={36} radius={10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: isSel ? 700 : 500, color: MC.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {s.name}
        </div>
        <div style={{
          fontFamily: MM, fontSize: 10, color: MC.ink3,
          textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {s.job_role ?? 'No role'}
        </div>
      </div>
      {dotCol && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotCol, flexShrink: 0 }} />
      )}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HRHubPage() {
  const navigate              = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const vp = p => `/v/${venueSlug}${p}`

  // Data
  const [staff,   setStaff]   = useState([])
  const [actions, setActions] = useState([])
  const [docs,    setDocs]    = useState([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [query,    setQuery]    = useState('')
  const [selected, setSelected] = useState(null)   // full staff obj from list
  const [tab,      setTab]      = useState('Profile')

  useEffect(() => {
    if (!venueId) return
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const in30    = addDays(new Date(), 30).toISOString().slice(0, 10)

    Promise.all([
      supabase.from('staff')
        .select('id, name, job_role, employment_type, start_date')
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
      const staffData = staffRes.data ?? []
      const actData   = actRes.data   ?? []
      const docsData  = docsRes.data  ?? []

      setStaff(staffData)
      setActions(actData)
      setDocs(docsData)
      setLoading(false)

      // Auto-select first flagged staff member, or first staff member
      const actionIds   = new Set(actData.map(a => a.staff_id))
      const expiringIds = new Set(docsData.map(d => d.staff_id))
      const firstFlagged = staffData.find(s => actionIds.has(s.id) || expiringIds.has(s.id))
      setSelected(firstFlagged || staffData[0] || null)
    })
  }, [venueId])

  const actionIds   = useMemo(() => new Set(actions.map(a => a.staff_id)), [actions])
  const expiringIds = useMemo(() => new Set(docs.map(d => d.staff_id)),    [docs])

  const flaggedCount = useMemo(
    () => staff.filter(s => actionIds.has(s.id) || expiringIds.has(s.id)).length,
    [staff, actionIds, expiringIds],
  )
  const docsExpiringCount = useMemo(
    () => new Set(docs.filter(d => {
      const ms = new Date(d.expiry_date).getTime() - Date.now()
      return ms >= 0  // ≥ today (within the 30d window already filtered by query)
    }).map(d => d.staff_id)).size,
    [docs],
  )

  // Search filter (query only — no dept filter; no department field in DB yet)
  const q = query.toLowerCase()
  const filtered = useMemo(() => staff.filter(s =>
    !q || s.name.toLowerCase().includes(q) || (s.job_role ?? '').toLowerCase().includes(q),
  ), [staff, q])

  const attentionRows = filtered.filter(s => actionIds.has(s.id) || expiringIds.has(s.id))
  const regularRows   = filtered.filter(s => !(actionIds.has(s.id) || expiringIds.has(s.id)))

  const openStaff = (s) => { setSelected(s); setTab('Profile') }

  // Stat tiles (shown as a compact row above the workspace grid)
  const stats = [
    { label: 'Active staff',    value: staff.length,      sub: 'on the books',  tone: null,                              icon: ICO.users  },
    { label: 'Needs attention', value: flaggedCount,       sub: 'staff',         tone: { fg: MC.bad,  bg: MC.badBg  },    icon: ICO.alert  },
    { label: 'Docs expiring',   value: docsExpiringCount,  sub: 'within 30 days',tone: { fg: MC.warn, bg: MC.warnBg },    icon: ICO.clock  },
    { label: 'Formal actions',  value: actionIds.size,     sub: 'last 90 days',  tone: actionIds.size > 0 ? { fg: MC.bad, bg: MC.badBg } : null, icon: ICO.gavel },
  ]

  return (
    <div style={{ fontFamily: MF, padding: '16px 0 96px' }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <LoadingSpinner />
        </div>
      ) : staff.length === 0 ? (
        /* Empty state */
        <div style={{ textAlign: 'center', padding: '60px 16px', color: MC.ink4 }}>
          <div style={{ marginBottom: 6, fontFamily: MM, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: MC.ink3 }}>Manager · Team</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: MC.ink, margin: '0 0 10px' }}>HR Records</h1>
          <p style={{ fontSize: 13.5, color: MC.ink3, marginBottom: 24 }}>No active staff members found.</p>
          <button
            onClick={() => navigate(vp('/settings'))}
            style={{
              background: MC.brand, color: '#fff', border: 'none', borderRadius: 11,
              padding: '10px 20px', cursor: 'pointer', fontFamily: MF, fontSize: 13, fontWeight: 600,
            }}
          >
            Add staff in Settings
          </button>
        </div>
      ) : (
        <>
          {/* Stat tiles row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 13, marginBottom: 22 }}>
            {stats.map(s => (
              <StatTile key={s.label} label={s.label} value={s.value} sub={s.sub} tone={s.tone} icon={s.icon} />
            ))}
          </div>

          {/* Workspace two-pane grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '316px 1fr', gap: 22, alignItems: 'start' }}>

            {/* ── Left column: sticky staff list ──────────────────────────── */}
            <div style={{ position: 'sticky', top: 76, height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
              {/* Column title */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: MM, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: MC.ink3, fontWeight: 600 }}>
                  Manager · Team
                </div>
                <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.025em', color: MC.ink, lineHeight: 1.1, margin: '4px 0 0', fontFamily: MF }}>
                  HR Records
                </h1>
              </div>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: MC.ink4, display: 'inline-flex', pointerEvents: 'none' }}>
                  {ICO.search}
                </span>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search staff…"
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px', borderRadius: 11,
                    border: `1px solid ${MC.line}`, fontSize: 13, fontFamily: MF,
                    outline: 'none', background: MC.paper, color: MC.ink, boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Add staff button */}
              <button
                onClick={() => navigate(vp('/settings'))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                  padding: '9px 13px', borderRadius: 11, border: `1px solid ${MC.line}`,
                  background: 'transparent', color: MC.ink3, cursor: 'pointer',
                  fontFamily: MF, fontSize: 13, fontWeight: 500, marginBottom: 14,
                }}
              >
                {ICO.plus}
                <span>Add staff</span>
              </button>

              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, paddingRight: 2 }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: MC.ink4, fontFamily: MM, fontSize: 11 }}>
                    No staff match your search
                  </div>
                ) : (
                  <>
                    {attentionRows.length > 0 && (
                      <>
                        <div style={{ fontFamily: MM, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: MC.bad, fontWeight: 700, padding: '8px 12px 5px' }}>
                          Needs attention · {attentionRows.length}
                        </div>
                        {attentionRows.map(s => (
                          <ListRow key={s.id} s={s} selected={selected} actionIds={actionIds} expiringIds={expiringIds} onClick={() => openStaff(s)} />
                        ))}
                      </>
                    )}
                    <div style={{ fontFamily: MM, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: MC.ink3, fontWeight: 700, padding: '10px 12px 5px' }}>
                      All staff · {regularRows.length}
                    </div>
                    {regularRows.map(s => (
                      <ListRow key={s.id} s={s} selected={selected} actionIds={actionIds} expiringIds={expiringIds} onClick={() => openStaff(s)} />
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* ── Right column: employee record ─────────────────────────── */}
            <div style={{ borderLeft: `1px solid ${MC.line}`, paddingLeft: 22, minHeight: 'calc(100vh - 160px)' }}>
              <EmployeeRecordPanel
                key={selected?.id}          // remount cleanly when selection changes
                staffId={selected?.id}
                venueId={venueId}
                venueSlug={venueSlug}
                onBack={null}               // no back button in workspace mode
                tab={tab}
                setTab={setTab}
              />
            </div>

          </div>
        </>
      )}
    </div>
  )
}
