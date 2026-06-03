import React from 'react'
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
  brand: '#13362a',
  ink:   '#111827', ink3: '#6b7280',
  line:  '#e5e7eb',
  paper: '#ffffff',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

function SectionWrap({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>{label}</div>
      <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden', padding: '4px 0' }}>
        {children}
      </div>
    </div>
  )
}

export default function StaffSettingsPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const { settings, reload: reloadSettings } = useVenueSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ padding: '16px 0 96px', maxWidth: 480, margin: '0 auto' }}>

      <button onClick={() => navigate(vp('/settings/hub'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: MC.brand, fontSize: 14, fontWeight: 500 }}>
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Staff & Roles</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Team members, roles, duties & access</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <SectionWrap label="Staff members">
          <StaffMembersSection />
        </SectionWrap>

        <SectionWrap label="Invite code">
          <VenueCodeSection venueId={venueId} sessionToken={session?.token} />
        </SectionWrap>

        <SectionWrap label="Roles">
          <RolesSection />
        </SectionWrap>

        <SectionWrap label="Permission levels">
          <PermissionTitlesSection
            venueId={venueId}
            titles={settings.permission_titles}
            reloadSettings={reloadSettings}
          />
        </SectionWrap>

        <SectionWrap label="Duties">
          <DutiesSection />
        </SectionWrap>

      </div>
    </div>
  )
}
