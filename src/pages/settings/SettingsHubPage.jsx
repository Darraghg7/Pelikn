import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAuth } from '../../contexts/AuthContext'
import { useAppSettings } from '../../hooks/useSettings'

// ── Design tokens ──────────────────────────────────────────────────────────
const MC = {
  brand:  '#13362a', brandTint: '#f0f7f4',
  bad:    '#c0392b', badBg:  '#fef2f2',
  warn:   '#d97706', warnBg: '#fffbeb',
  ink:    '#111827', ink3: '#6b7280', ink4: '#9ca3af',
  line:   '#e5e7eb', line2: '#f3f4f6',
  paper:  '#ffffff',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

// ── Icons ──────────────────────────────────────────────────────────────────
function VenueIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
}
function StaffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function AttendanceIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
}
function ComplianceIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>
}
function FeaturesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}
function BillingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
}
function IntegrationsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
}
function HelpIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
}

// ── SettingsCard ───────────────────────────────────────────────────────────
function SettingsCard({ label, sub, icon: Icon, attention, statusText, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        background: MC.paper, border: `1px solid ${MC.line}`,
        borderRadius: 14, padding: '13px 13px 12px',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{
          width: 34, height: 34, borderRadius: 9,
          background: attention ? MC.warnBg : MC.brandTint,
          color: attention ? MC.warn : MC.brand,
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{ width: 17, height: 17, display: 'inline-flex' }}><Icon /></span>
        </span>
        {attention && <span style={{ width: 7, height: 7, borderRadius: 4, background: MC.warn }} />}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: MC.ink }}>{label}</div>
        <div style={{
          fontFamily: MONO, fontSize: 10, marginTop: 3,
          color: attention ? MC.warn : MC.ink3,
          fontWeight: attention ? 600 : 500,
          letterSpacing: '0.01em',
          textTransform: attention ? 'uppercase' : 'none',
        }}>{attention ? statusText : sub}</div>
      </div>
    </button>
  )
}

// ── SettingsHubPage ────────────────────────────────────────────────────────
export default function SettingsHubPage() {
  const navigate = useNavigate()
  const { venueSlug, venueName } = useVenue()
  const { session } = useSession()
  const { signOutVenue } = useAuth()
  const { lateGraceMins } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  const isOwner = session?.staffRole === 'owner'
  const staffName = session?.name ?? 'Manager'
  const role = session?.staffRole === 'owner' ? 'Owner' : session?.staffRole === 'manager' ? 'General Manager' : 'Manager'


  const initials = staffName.split(' ').map(w => w[0]).slice(0, 2).join('')

  // Attendance attention: grace is on (non-zero) = might surprise staff
  const attendanceAttention = lateGraceMins > 0

  const cards = [
    { id: 'venue',        label: 'Venue',         sub: 'Hours, closing days', icon: VenueIcon,        route: vp('/settings') },
    { id: 'staff',        label: 'Staff & Roles',  sub: 'Team, permissions',   icon: StaffIcon,        route: vp('/staff') },
    { id: 'attendance',   label: 'Attendance',     sub: 'Clock-in & breaks',   icon: AttendanceIcon,   route: vp('/settings/attendance'),
      attention: attendanceAttention, statusText: `Grace: ${lateGraceMins}min` },
    { id: 'compliance',   label: 'Compliance',     sub: 'Schedules, HACCP',    icon: ComplianceIcon,   route: vp('/settings') },
    { id: 'features',     label: 'Features',       sub: 'Hub tile visibility', icon: FeaturesIcon,     route: vp('/settings/hub-tiles') },
    { id: 'notifications',label: 'Notifications',  sub: 'Alerts & digest',     icon: BellIcon,         route: vp('/settings') },
    ...(isOwner ? [{ id: 'billing', label: 'Plan & Billing', sub: 'Subscription', icon: BillingIcon, route: vp('/settings') }] : []),
    { id: 'integrations', label: 'Integrations',   sub: 'Connect apps',        icon: IntegrationsIcon, route: vp('/settings') },
    { id: 'help',         label: 'Help & Support', sub: 'Docs, contact',       icon: HelpIcon,         route: vp('/settings') },
  ]

  return (
    <div style={{ padding: '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em', margin: '0 0 14px', color: MC.ink }}>Settings</h1>

      {/* Profile hero */}
      <button
        onClick={() => navigate(vp('/settings'))}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          background: MC.brand, color: '#fff',
          border: 'none', borderRadius: 14, padding: 16,
          display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14,
        }}
      >
        <span style={{
          width: 50, height: 50, borderRadius: 13, flexShrink: 0,
          background: 'rgba(255,255,255,0.16)',
          display: 'grid', placeItems: 'center',
          fontFamily: MONO, fontSize: 16, fontWeight: 600,
        }}>{initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>{staffName}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
            {role}{venueName ? ` · ${venueName}` : ''}
          </div>
        </div>
        <svg width="8" height="13" viewBox="0 0 6 10" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </button>

      {/* Category grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
        {cards.map(c => (
          <SettingsCard
            key={c.id}
            label={c.label}
            sub={c.sub}
            icon={c.icon}
            attention={c.attention}
            statusText={c.statusText}
            onClick={() => navigate(c.route)}
          />
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={signOutVenue}
        style={{
          width: '100%', height: 48, borderRadius: 13,
          border: `1px solid ${MC.bad}33`, background: MC.badBg,
          color: MC.bad, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 12,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        Sign out
      </button>

      <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 10, color: MC.ink4, letterSpacing: '0.04em' }}>
        Pelikn
      </div>
    </div>
  )
}
