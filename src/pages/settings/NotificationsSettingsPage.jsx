import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAppSettings } from '../../hooks/useSettings'
import NotificationsPanel from './NotificationsPanel'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'
import Toggle from '../../components/ui/Toggle'

export default function NotificationsSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { session } = useSession()
  const { pushToManager, savePushToManager, notifyBreakOverrun, saveNotifyBreakOverrun } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div>
      <SettingsSubHeader title="Notifications" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="pb-24 max-w-[480px] mx-auto">

        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[14px] pb-[7px] px-0.5">Attendance alerts</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden">
          <div className="flex items-center gap-3 px-[15px] py-[13px] border-b border-charcoal/6 dark:border-white/8">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">Lateness escalation</div>
              <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">Notify manager when an attendance strike threshold is reached</div>
            </div>
            <Toggle checked={pushToManager} onChange={savePushToManager} />
          </div>
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">Break overrun</div>
              <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">Notify manager when a staff member exceeds their allowed break time</div>
            </div>
            <Toggle checked={notifyBreakOverrun} onChange={saveNotifyBreakOverrun} />
          </div>
        </div>

        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[14px] pb-[7px] px-0.5">Push notification preferences</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden px-4 py-[14px]">
          <NotificationsPanel session={session} settings={{}} />
        </div>

      </div>
    </div>
  )
}
