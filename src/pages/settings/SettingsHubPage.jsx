import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAuth } from '../../contexts/AuthContext'
import { useAppSettings } from '../../hooks/useSettings'

const MC = {
  brand:  '#13362a', brandTint: '#eef4f0',
  bad:    '#b3331c', badBg:  '#fbeae6',
  warn:   '#a85d12', warnBg: '#fbeedc',
  ink:    '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line:   '#e4e6e2', line2: '#eef0ec',
  paper:  '#ffffff', bg: '#f3f3ef',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function GroupLabel({ label }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.10em',
      textTransform: 'uppercase', color: MC.ink3, padding: '12px 4px 6px',
    }}>{label}</div>
  )
}

function RowGroup({ children }) {
  return (
    <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function SRow({ icon, label, sub, value, attention, last, onClick, danger }) {
  const iBg  = attention ? MC.warnBg  : danger ? MC.badBg  : MC.brandTint
  const iCol = attention ? MC.warn    : danger ? MC.bad    : MC.brand
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', background: 'none', border: 'none',
        cursor: onClick ? 'pointer' : 'default', padding: '0 14px',
        borderBottom: last ? 'none' : `1px solid ${MC.line2}`,
        display: 'flex', alignItems: 'center', gap: 13, minHeight: 58,
        fontFamily: SANS,
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: iBg, color: iCol, display: 'grid', placeItems: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0, padding: '13px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: danger ? MC.bad : MC.ink, lineHeight: 1.25 }}>{label}</div>
        {sub && <div style={{ fontFamily: MONO, fontSize: 10.5, color: attention ? MC.warn : MC.ink3, marginTop: 2, letterSpacing: '0.01em', lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {value && <span style={{ fontFamily: MONO, fontSize: 11, color: MC.ink3, flexShrink: 0 }}>{value}</span>}
      {onClick && (
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={attention ? MC.warn : MC.ink4} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      )}
    </button>
  )
}

export default function SettingsHubPage() {
  const navigate = useNavigate()
  const { venueSlug, venueName } = useVenue()
  const { session } = useSession()
  const { signOutVenue } = useAuth()
  const { lateGraceMins } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  const isOwner  = session?.staffRole === 'owner'
  const staffName = session?.name ?? 'Manager'
  const role = session?.staffRole === 'owner' ? 'Owner' : session?.staffRole === 'manager' ? 'General Manager' : 'Manager'
  const initials = staffName.split(' ').map(w => w[0]).slice(0, 2).join('')

  const attendanceAttention = lateGraceMins > 0

  return (
    <div style={{ padding: '16px 0 96px' }}>

      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em', margin: '0 0 14px', color: MC.ink }}>Settings</h1>

      {/* Profile hero */}
      <button
        onClick={() => navigate(vp('/settings/hub'))}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          background: MC.brand, color: '#fff',
          border: 'none', borderRadius: 14, padding: 16,
          display: 'flex', alignItems: 'center', gap: 13, marginBottom: 4,
          fontFamily: SANS,
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
          <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
            {role}{venueName ? ` · ${venueName}` : ''}
          </div>
        </div>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </button>

      {/* Account */}
      <GroupLabel label="Account" />
      <RowGroup>
        <SRow
          icon={<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>}
          label="Venue"
          sub="Name, logo, hours, venues, appearance"
          onClick={() => navigate(vp('/settings/venue'))}
        />
        <SRow
          icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>}
          label="Staff & Roles"
          sub="Members, invite code, roles, duties"
          onClick={() => navigate(vp('/settings/staff'))}
          last
        />
      </RowGroup>

      {/* Operations */}
      <GroupLabel label="Operations" />
      <RowGroup>
        <SRow
          icon={<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>}
          label="Attendance"
          sub={attendanceAttention ? `Grace: ${lateGraceMins} min · Breaks on` : 'Clock-in & break rules'}
          attention={attendanceAttention}
          onClick={() => navigate(vp('/settings/attendance'))}
        />
        <SRow
          icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></>}
          label="Compliance"
          sub="Fridge check time, action schedules"
          onClick={() => navigate(vp('/settings/compliance'))}
        />
        <SRow
          icon={<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>}
          label="Notifications"
          sub="Push alerts, digest, reminders"
          onClick={() => navigate(vp('/settings/notifications'))}
          last
        />
      </RowGroup>

      {/* Customise */}
      <GroupLabel label="Customise" />
      <RowGroup>
        <SRow
          icon={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>}
          label="Features"
          sub="Enable or disable modules"
          onClick={() => navigate(vp('/settings/hub-tiles'))}
          last
        />
      </RowGroup>

      {/* More */}
      <GroupLabel label="More" />
      <RowGroup>
        {isOwner && (
          <SRow
            icon={<><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></>}
            label="Plan & Billing"
            sub="Subscription & usage"
            onClick={() => navigate(vp('/settings/billing'))}
          />
        )}
        <SRow
          icon={<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></>}
          label="Help & Support"
          sub="FAQ, docs, contact"
          onClick={() => navigate(vp('/settings/help'))}
          last
        />
      </RowGroup>

      {/* Sign out */}
      <button
        onClick={signOutVenue}
        style={{
          width: '100%', height: 50, marginTop: 14, borderRadius: 13,
          border: `1px solid rgba(179,51,28,0.2)`, background: MC.badBg,
          color: MC.bad, cursor: 'pointer', fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: SANS, letterSpacing: '-0.01em',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        Sign out
      </button>

      <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 10, color: MC.ink4, letterSpacing: '0.08em', padding: '12px 0 0' }}>
        Pelikn
      </div>
    </div>
  )
}
