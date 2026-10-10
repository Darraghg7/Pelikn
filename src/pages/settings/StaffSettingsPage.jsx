import React from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import VenueCodeSection from './VenueCodeSection'
import RolesSection from './RolesSection'
import DutiesSection from './DutiesSection'
import { TabBar } from '../../components/temperature/TempPageParts'

const TABS = [
  { id: 'invite',  label: 'Invite' },
  { id: 'roles',   label: 'Departments' },
  { id: 'duties',  label: 'Duties' },
]

/**
 * Team setup: the venue-wide rules for people (invite code, the departments
 * list, duties). The people themselves live on one page, Team → Staff
 * (/staff). This page used to carry a second copy of that list as its
 * "Members" tab; old links into it (?staff=<id>|new, ?tab=members) are
 * forwarded there so bookmarks and the Getting Started card keep working.
 */
export default function StaffSettingsPage() {
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const [params, setParams] = useSearchParams()

  const rawTab  = params.get('tab')
  const staffId = params.get('staff')
  if (staffId) return <Navigate to={`/v/${venueSlug}/staff?staff=${encodeURIComponent(staffId)}`} replace />
  if (rawTab === 'members') return <Navigate to={`/v/${venueSlug}/staff`} replace />

  const tab    = TABS.some(t => t.id === rawTab) ? rawTab : 'invite'
  const setTab = (id) => setParams({ tab: id }, { replace: true })

  return (
    <div className="max-w-[480px] md:max-w-2xl lg:max-w-3xl mx-auto flex flex-col gap-2.5">
      <div className="flex flex-col gap-1 pt-1">
        <Link
          to={`/v/${venueSlug}/settings/hub`}
          className="self-start inline-flex items-center gap-1 text-body-sm font-semibold text-brand dark:text-white/80 hover:opacity-75"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Settings
        </Link>
        <div className="flex items-center justify-between gap-2.5">
          <h1 className="text-title leading-tight font-bold tracking-tight text-ink dark:text-white whitespace-nowrap">Team setup</h1>
          <Link
            to={`/v/${venueSlug}/staff`}
            className="shrink-0 inline-flex items-center gap-1 h-8 px-3.5 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-body-sm font-semibold text-ink dark:text-white hover:border-ink4"
          >
            Manage staff
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        </div>
      </div>

      <TabBar tabs={TABS} size="sm" active={tab} onChange={setTab} />

      {tab === 'invite' && (
        <VenueCodeSection venueId={venueId} sessionToken={session?.token} />
      )}

      {tab === 'roles' && (
        <div className="flex flex-col gap-2.5">
          <RolesSection />
        </div>
      )}

      {tab === 'duties' && <DutiesSection />}
    </div>
  )
}
