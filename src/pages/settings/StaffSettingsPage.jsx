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
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

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
    <div className="min-h-screen bg-surface">
      <SettingsSubHeader title="Staff & Roles" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="flex bg-white dark:bg-paperDark border-b border-charcoal/10 px-4 gap-0.5 sticky top-[49px] z-[9]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-[12px] pb-[11px] text-[13px] border-b-2 -mb-px transition-all whitespace-nowrap ${
              tab === t.id
                ? 'font-semibold text-brand border-brand'
                : 'font-medium text-charcoal/50 border-transparent hover:text-charcoal'
            }`}
          >{t.label}</button>
        ))}
      </div>

      <div className={`${tab === 'members' ? 'pb-24' : 'px-4 pt-4 pb-24'} max-w-[480px] mx-auto`}>
        {tab === 'members' && <StaffMembersSection />}

        {tab === 'invite' && (
          <VenueCodeSection venueId={venueId} sessionToken={session?.token} />
        )}

        {tab === 'roles' && (
          <div className="flex flex-col gap-4">
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
