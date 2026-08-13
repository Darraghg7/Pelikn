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
    <div>
      <SettingsSubHeader title="Staff & Roles" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="sticky top-[49px] z-[9] bg-surface dark:bg-[#111111] pt-3 pb-2">
        <div className="max-w-[480px] md:max-w-2xl lg:max-w-3xl mx-auto flex bg-charcoal/[0.05] dark:bg-white/5 rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-white dark:bg-paperDark text-charcoal dark:text-white shadow-sm'
                  : 'text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className={`${tab === 'members' ? 'pb-24' : 'px-4 pt-4 pb-24'} max-w-[480px] md:max-w-2xl lg:max-w-3xl mx-auto`}>
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
