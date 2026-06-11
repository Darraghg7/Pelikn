import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import StaffMembersSection from './StaffMembersSection'
import VenueCodeSection from './VenueCodeSection'
import RolesSection from './RolesSection'
import PermissionTitlesSection from './PermissionTitlesSection'
import DutiesSection from './DutiesSection'
import useVenueSettings from '../../hooks/useVenueSettings'

const MC = {
  brand: '#13362a', brandTint: '#eef4f0',
  ink:   '#0d1a14', ink3: '#76817b', ink4: '#b3b9b5',
  line:  '#e4e6e2', line2: '#eef0ec',
  paper: '#ffffff', bg: '#f3f3ef',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function SubHeader({ title, onBack }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'rgba(243,243,239,0.92)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `1px solid ${MC.line}`,
      padding: '12px 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: MC.brand, background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px 0', fontFamily: SANS, fontSize: 15, fontWeight: 500,
      }}>
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L1.5 7.5 8 14"/>
        </svg>
        Settings
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: MC.ink }}>{title}</span>
      <span style={{ width: 70 }} />
    </div>
  )
}

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'invite',  label: 'Invite' },
  { id: 'roles',   label: 'Roles' },
  { id: 'duties',  label: 'Duties' },
]


export default function StaffSettingsPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const { settings, reload: reloadSettings } = useVenueSettings()
  const [tab, setTab] = useState('members')

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ minHeight: '100vh', background: MC.bg, fontFamily: SANS }}>
      <SubHeader title="Staff & Roles" onBack={() => navigate(vp('/settings/hub'))} />

      {/* Tab strip */}
      <div style={{
        display: 'flex', background: MC.paper, borderBottom: `1px solid ${MC.line}`,
        padding: '0 16px', gap: 2,
        position: 'sticky', top: 49, zIndex: 9,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 12px 11px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: SANS, fontSize: 13, fontWeight: tab === t.id ? 600 : 500,
              color: tab === t.id ? MC.brand : MC.ink3,
              borderBottom: tab === t.id ? `2px solid ${MC.brand}` : '2px solid transparent',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >{t.label}</button>
        ))}
      </div>

      <div style={{ padding: tab === 'members' ? '0 0 96px' : '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>
        {tab === 'members' && <StaffMembersSection />}

        {tab === 'invite' && (
          <VenueCodeSection venueId={venueId} sessionToken={session?.token} />
        )}

        {tab === 'roles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <RolesSection />
            <PermissionTitlesSection
              venueId={venueId}
              titles={settings.permission_titles}
              reloadSettings={reloadSettings}
            />
          </div>
        )}

        {tab === 'duties' && <DutiesSection />}
      </div>
    </div>
  )
}
