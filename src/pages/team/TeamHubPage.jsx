import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useTeamStatus } from '../../hooks/useTeamStatus'
import { useAppSettings } from '../../hooks/useSettings'

// ── Design tokens ──────────────────────────────────────────────────────────
const MC = {
  brand:  '#13362a',
  bad:    '#b3331c', badBg:  '#fbeae6',
  warn:   '#a85d12', warnBg: '#fbeedc',
  good:   '#1a7a4c', goodBg: '#e3f0e7',
  draft:  '#c94f2a', draftBg: '#faeee9',
  ink:    '#0d1a14', ink2:   '#3d4a44', ink3:   '#76817b', ink4:   '#b3b9b5',
  line:   '#e4e6e2', line2:  '#eef0ec',
  paper:  '#ffffff',
}

const STATUS_TONE = {
  overdue: { fg: MC.bad,   bg: MC.badBg,   rank: 0 },
  due:     { fg: MC.warn,  bg: MC.warnBg,  rank: 1 },
  draft:   { fg: MC.draft, bg: MC.draftBg, rank: 2 },
  done:    { fg: MC.good,  bg: MC.goodBg,  rank: 3 },
  na:      { fg: MC.ink3,  bg: MC.line2,   rank: 4 },
}

const MONO = 'ui-monospace, SFMono-Regular, monospace'

// ── Icons ──────────────────────────────────────────────────────────────────
function CalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function RotaIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 14h2M14 14h2M8 17.5h2"/></svg>
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
}
function GradCapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
}
function LeafIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M21 3 9 15M15 3H21V9"/><path d="M18 13C18 17.4183 14.4183 21 10 21C5.58172 21 2 17.4183 2 13C2 8.58172 5.58172 5 10 5"/></svg>
}
function UsersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

// ── Avatar initials chip ───────────────────────────────────────────────────
function AvatarChip({ name, status, index }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return (
    <span
      title={name}
      style={{
        width: 30, height: 30, borderRadius: 8,
        marginLeft: index === 0 ? 0 : -6,
        background: 'rgba(255,255,255,0.16)', color: '#fff',
        border: `1.5px solid ${MC.brand}`,
        display: 'grid', placeItems: 'center',
        fontFamily: MONO, fontSize: 10.5, fontWeight: 600,
        position: 'relative', zIndex: 6 - index,
        flexShrink: 0,
      }}
    >
      {initials}
      {status === 'late' && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 9, height: 9, borderRadius: 5,
          background: '#ff6b52', border: `1.5px solid ${MC.brand}`,
        }} />
      )}
      {status === 'break' && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 9, height: 9, borderRadius: 5,
          background: '#f2c48f', border: `1.5px solid ${MC.brand}`,
        }} />
      )}
    </span>
  )
}

// ── Attendance hero card ───────────────────────────────────────────────────
function AttendanceHero({ onShift, lateCount, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: MC.brand, color: '#fff',
        border: 'none', borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 600,
        }}>On shift now</div>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', marginTop: 3 }}>
          {loading
            ? 'Loading…'
            : onShift.length === 0
              ? 'No staff clocked in yet'
              : `${onShift.length} clocked in`}
        </div>
        {!loading && lateCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#ffb4a6',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
              {lateCount} late
            </span>
          </div>
        )}
      </div>
      <span style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
        textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
      }}>
        Attendance
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </span>
    </button>
  )
}

// ── Team status card ───────────────────────────────────────────────────────
function TeamCard({ label, icon: Icon, status, statusText, count, onClick, editMode, isHidden, onToggle }) {
  const t = STATUS_TONE[status]
  return (
    <button
      onClick={editMode ? onToggle : onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        background: MC.paper,
        border: `1px solid ${!editMode && status === 'overdue' ? t.fg + '55' : MC.line}`,
        borderRadius: 12, padding: '12px',
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 84,
        opacity: editMode && isHidden ? 0.38 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9,
          background: t.bg, color: t.fg,
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{ width: 15, height: 15, display: 'inline-flex' }}><Icon /></span>
        </span>

        {editMode ? (
          <span style={{
            width: 20, height: 20, borderRadius: 10, flexShrink: 0,
            border: `2px solid ${isHidden ? MC.line : MC.good}`,
            background: isHidden ? 'transparent' : MC.good,
            display: 'grid', placeItems: 'center',
          }}>
            {!isHidden && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>
        ) : count && status !== 'done' && status !== 'na' ? (
          <span style={{
            minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
            background: t.fg, color: '#fff',
            fontFamily: MONO, fontSize: 11, fontWeight: 600, display: 'grid', placeItems: 'center',
          }}>{count}</span>
        ) : status === 'done' ? (
          <span style={{ color: t.fg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: MC.ink }}>{label}</div>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, marginTop: 3,
          color: editMode ? (isHidden ? MC.ink4 : MC.good) : t.fg,
          fontWeight: 600,
          letterSpacing: '0.02em', textTransform: 'uppercase',
        }}>
          {editMode ? (isHidden ? 'Hidden' : 'Visible') : statusText}
        </div>
      </div>
    </button>
  )
}

// ── TeamHubPage ────────────────────────────────────────────────────────────
export default function TeamHubPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const vp = (path) => `/v/${venueSlug}${path}`

  const { data, loading } = useTeamStatus(venueId)
  const { hiddenTeamTiles, saveHiddenTeamTiles } = useAppSettings()

  const [editMode, setEditMode] = useState(false)
  const [localHidden, setLocalHidden] = useState([])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayStr  = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  function handleEdit() {
    setLocalHidden(hiddenTeamTiles ?? [])
    setEditMode(true)
  }

  function handleDone() {
    saveHiddenTeamTiles(localHidden)
    setEditMode(false)
  }

  function toggleTile(id) {
    setLocalHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const ALL_CARDS = [
    {
      id: 'team-rota', label: 'Rota', icon: RotaIcon, route: '/rota',
      ...(data?.rotaPublished
        ? { status: 'done', statusText: 'Published' }
        : {
            status: 'draft',
            statusText: data?.rotaUnfilled > 0
              ? `Draft · ${data.rotaUnfilled} to fill`
              : 'Draft · ready to publish',
            count: data?.rotaUnfilled || undefined,
          }),
    },
    {
      id: 'rota', label: 'My Shifts', icon: CalIcon, route: '/rota?personal=1',
      ...(data?.pendingSwaps > 0
        ? { status: 'due', statusText: `${data.pendingSwaps} swap${data.pendingSwaps > 1 ? 's' : ''} pending`, count: data.pendingSwaps }
        : { status: 'done', statusText: 'No swaps pending' }),
    },
    {
      id: 'timesheet', label: 'Hours', icon: ClockIcon, route: '/timesheet',
      status: 'na', statusText: 'View timesheets',
    },
    {
      id: 'training', label: 'Training', icon: GradCapIcon, route: '/training',
      ...(data?.expiringTraining > 0
        ? { status: 'due', statusText: `${data.expiringTraining} expiring`, count: data.expiringTraining }
        : { status: 'done', statusText: 'All up to date' }),
    },
    {
      id: 'time-off', label: 'Time Off', icon: LeafIcon, route: '/time-off',
      ...(data?.pendingTimeOff > 0
        ? { status: 'due', statusText: `${data.pendingTimeOff} pending`, count: data.pendingTimeOff }
        : { status: 'done', statusText: 'No requests' }),
    },
    {
      id: 'staff', label: 'Staff Members', icon: UsersIcon, route: '/staff',
      status: 'na',
      statusText: loading ? '…' : `${data?.totalStaff ?? 0} active`,
    },
  ]

  const ordered = editMode
    ? ALL_CARDS
    : ALL_CARDS
        .filter(c => !(hiddenTeamTiles ?? []).includes(c.id))
        .sort((a, b) => (STATUS_TONE[a.status]?.rank ?? 4) - (STATUS_TONE[b.status]?.rank ?? 4))

  return (
    <div style={{ padding: '16px 0 96px' }}>

      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Team
          </span>
          <button
            onClick={editMode ? handleDone : handleEdit}
            style={{
              fontFamily: MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em',
              color: editMode ? MC.good : MC.ink3,
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
            }}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1.12, margin: '4px 0 0', color: MC.ink }}>
          Your team
        </h1>
        {editMode && (
          <div style={{ marginTop: 5, fontSize: 12, color: MC.ink3, fontFamily: MONO }}>
            Tap a tile to show or hide it
          </div>
        )}
      </div>

      {/* Live attendance hero — hidden in edit mode */}
      {!editMode && (
        <div style={{ marginBottom: 14 }}>
          <AttendanceHero
            onShift={data?.onShift ?? []}
            lateCount={data?.lateCount ?? 0}
            loading={loading}
            onClick={() => navigate(vp('/timesheet'))}
          />
        </div>
      )}

      {/* Status grid */}
      {loading && !editMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ height: 104, borderRadius: 14, background: MC.line2 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ordered.map(c => (
            <TeamCard
              key={c.id}
              label={c.label}
              icon={c.icon}
              status={c.status}
              statusText={c.statusText}
              count={c.count}
              onClick={() => navigate(vp(c.route))}
              editMode={editMode}
              isHidden={localHidden.includes(c.id)}
              onToggle={() => toggleTile(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
