import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import ActionSchedulesSection from './ActionSchedulesSection'
import TimeSelect from '../../components/ui/TimeSelect'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'
import Toggle from '../../components/ui/Toggle'

export default function ComplianceSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const {
    actionSchedules, fridgeCheckTime, cleaningVisibleToAll, enforceClosingChecklist,
    saveActionSchedules, saveFridgeCheckTime, saveCleaningVisibleToAll, saveEnforceClosingChecklist,
  } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div>
      <SettingsSubHeader title="Compliance" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="pb-24 max-w-[480px] mx-auto">

        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[18px] pb-[7px] px-0.5">Fridge checks</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden">
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">Default check time</div>
              <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">When the daily fridge check is expected</div>
            </div>
            <div className="w-[120px] shrink-0">
              <TimeSelect value={fridgeCheckTime} onChange={saveFridgeCheckTime} />
            </div>
          </div>
        </div>

        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[18px] pb-[7px] px-0.5">Cleaning</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden">
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">Everyone sees every cleaning task</div>
              <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">Staff can see and tick off other departments' cleaning</div>
            </div>
            <Toggle checked={cleaningVisibleToAll} onChange={saveCleaningVisibleToAll} />
          </div>
        </div>
        <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 pt-2 px-1 leading-[1.45]">
          {cleaningVisibleToAll
            ? 'On — every staff member sees the full cleaning schedule, labelled by department. Checklists are not affected.'
            : 'Off — staff only see cleaning tasks for their own departments, plus tasks set to Everyone. Checklists are not affected.'}
        </div>

        <div id="closing-checklist" className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[18px] pb-[7px] px-0.5">Closing checklist</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] overflow-hidden">
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">Closers sign off before clocking out</div>
              <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">Only for shifts marked as closing on the rota</div>
            </div>
            <Toggle checked={enforceClosingChecklist} onChange={saveEnforceClosingChecklist} />
          </div>
        </div>
        <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 pt-2 px-1 leading-[1.45]">
          {enforceClosingChecklist
            ? "On — closers can't clock out until the closing checks for their departments (and any set to Everyone) are done. Anyone in no department answers for all of them. If they didn't tick any themselves, they confirm with Accept. A manager PIN can always override."
            : 'Off — closing checks are logged, but clocking out is never blocked.'}
        </div>

        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 pt-[18px] pb-[7px] px-0.5">Daily action schedules</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-[15px] pt-1 pb-2">
          <ActionSchedulesSection schedules={actionSchedules} onSave={saveActionSchedules} />
        </div>
        <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 pt-2 px-1 leading-[1.45]">
          Configure which compliance checks are active and on which days of the week they appear on the dashboard.
        </div>

      </div>
    </div>
  )
}
