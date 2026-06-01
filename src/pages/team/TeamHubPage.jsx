import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useTeamStatus } from '../../hooks/useTeamStatus'
import { useAppSettings } from '../../hooks/useSettings'

// ── Design tokens ──────────────────────────────────────────────────────────
const MC = {
  brand:  '#13362a',
  bad:    '#c0392b', badBg:  '#fef2f2',
  warn:   '#d97706', warnBg: '#fffbeb',
  good:   '#16a34a', goodBg: '#f0fdf4',
  ink:    '#111827', ink2:   '#374151', ink3:   '#6b7280', ink4:   '#9ca3af',
  line:   '#e5e7eb', line2:  '#f3f4f6',
  paper:  '#ffffff',
}

const STATUS_TONE = {
  overdue: { fg: MC.bad,  bg: MC.badBg,  rank: 0 },
  due:     { fg: MC.warn, bg: MC.warnBg, rank: 1 },
  done:    { fg: MC.good, bg: MC.goodBg, rank: 3 },
  na:      { fg: MC.ink3, bg: MC.line2,  rank: 4 },
}

const MONO = 'ui-monospace, SFMono-Regular, monospace'

// ── Icons ──────────────────────────────────────────────────────────────────
function CalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
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
        border: 'none', borderRadius: 14, padding: '15px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 600,
        }}>On shift now</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
          textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
        }}>
          Attendance
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l4 4-4 4"/>
          </svg>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {loading ? '—' : onShift.length}
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>clocked in</span>
        {!loading && lateCount > 0 && (
          <span style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#ffb4a6',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
            {lateCount} late
          </span>
        )}
      </div>

      {/* Avatar stack */}
      {!loading && onShift.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 13 }}>
          {onShift.slice(0, 6).map((p, i) => (
            <AvatarChip key={p.id} name={p.name} status={p.status} index={i} />
          ))}
          {onShift.length > 6 && (
            <span style={{
              marginLeft: 4, fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.6)',
            }}>+{onShift.length - 6}</span>
          )}
        </div>
      )}
      {!loading && onShift.length === 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>
          No staff clocked in yet
        </div>
      )}
    </button>
  )
}

// ── Team status card ───────────────────────────────────────────────────────
function TeamCard({ label, icon: Icon, status, statusText, count, onClick }) {
  const t = STATUS_TONE[status]
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        background: MC.paper,
        border: `1px solid ${status === 'overdue' ? t.fg + '55' : MC.line}`,
        borderRadius: 14, padding: '13px 13px 12px',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 104,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{
          width: 34, height: 34, borderRadius: 9,
          background: t.bg, color: t.fg,
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{ width: 17, height: 17, display: 'inline-flex' }}><Icon /></span>
        </span>
        {count && status !== 'done' && status !== 'na' ? (
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
          color: t.fg, fontWeight: 600,
          letterSpacing: '0.02em', textTransform: 'uppercase',
        }}>{statusText}</div>
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
  const { hiddenTeamTiles } = useAppSettings()

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayStr  = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  // Build status cards with live data
  const cards = [
    {
      id: 'rota', label: 'Rota', icon: CalIcon, route: '/rota',
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

  // Sort action-first
  const ordered = cards
    .filter(c => !hiddenTeamTiles.includes(c.id))
    .sort((a, b) => (STATUS_TONE[a.status]?.rank ?? 4) - (STATUS_TONE[b.status]?.rank ?? 4))

  return (
    <div style={{ padding: '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Team
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink4 }}>{dayStr} · {timeStr}</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1.12, margin: '5px 0 0', color: MC.ink }}>
          Your team
        </h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 5 }}>
          {loading ? '…' : `${data?.totalStaff ?? 0} members · ${data?.onShift?.length ?? 0} on shift now`}
        </div>
      </div>

      {/* Live attendance hero */}
      <div style={{ marginBottom: 14 }}>
        <AttendanceHero
          onShift={data?.onShift ?? []}
          lateCount={data?.lateCount ?? 0}
          loading={loading}
          onClick={() => navigate(vp('/timesheet'))}
        />
      </div>

      {/* Status grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ height: 104, borderRadius: 14, background: MC.line2 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {ordered.map(c => (
            <TeamCard
              key={c.id}
              label={c.label}
              icon={c.icon}
              status={c.status}
              statusText={c.statusText}
              count={c.count}
              onClick={() => navigate(vp(c.route))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
