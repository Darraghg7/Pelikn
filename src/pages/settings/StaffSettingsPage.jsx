import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import StaffMembersSection from './StaffMembersSection'
import VenueCodeSection from './VenueCodeSection'
import RolesSection from './RolesSection'
import PermissionTitlesSection from './PermissionTitlesSection'
import DutiesSection from './DutiesSection'
import { TabBar } from '../../components/temperature/TempPageParts'

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'invite',  label: 'Invite' },
  { id: 'roles',   label: 'Departments' },
  { id: 'duties',  label: 'Duties' },
]

/**
 * Staff & roles. The tab and the person being edited live in the URL
 * (?tab=roles, ?staff=<id>|new) so the phone's back button steps out of a
 * person's page to the list, and a refresh stays where you were.
 */
export default function StaffSettingsPage() {
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const [params, setParams] = useSearchParams()

  const tab      = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'members'
  const detailId = tab === 'members' ? params.get('staff') : null

  const setTab    = (id) => setParams(id === 'members' ? {} : { tab: id }, { replace: true })
  const openStaff = (id) => setParams({ staff: id }, { replace: !!detailId })   // new entry from the list, replace within a person
  // Replace, so Back from the list doesn't reopen the person just closed
  const closeStaff = () => setParams({}, { replace: true })

  return (
    <div className={`${detailId ? 'pb-8' : ''} max-w-[480px] md:max-w-2xl lg:max-w-3xl mx-auto flex flex-col gap-2.5`}>
      {!detailId && (
        <>
          <div className="flex flex-col gap-1 pt-1">
            <Link
              to={`/v/${venueSlug}/settings/hub`}
              className="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-brand dark:text-white/80 hover:opacity-75"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Settings
            </Link>
            <div className="flex items-center justify-between gap-2.5">
              <h1 className="text-[20px] min-[420px]:text-[22px] leading-tight font-bold tracking-tight text-ink dark:text-white whitespace-nowrap">Staff &amp; departments</h1>
              {tab === 'members' && (
                <button
                  type="button"
                  onClick={() => openStaff('new')}
                  className="shrink-0 inline-flex items-center gap-2 h-8 px-3.5 rounded-xl bg-brand text-white text-[13px] min-[420px]:text-[13px] font-semibold hover:bg-brand/90 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Add staff
                </button>
              )}
            </div>
          </div>

          <TabBar tabs={TABS} size="sm" active={tab} onChange={setTab} />
        </>
      )}

      {tab === 'members' && (
        <StaffMembersSection detailId={detailId} onOpen={openStaff} onClose={closeStaff} />
      )}

      {tab === 'invite' && (
        <VenueCodeSection venueId={venueId} sessionToken={session?.token} />
      )}

      {tab === 'roles' && (
        <div className="flex flex-col gap-2.5">
          <RolesSection />
          <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35 mt-4">Permission titles</p>
          <PermissionTitlesSection />
        </div>
      )}

      {tab === 'duties' && <DutiesSection />}
    </div>
  )
}
