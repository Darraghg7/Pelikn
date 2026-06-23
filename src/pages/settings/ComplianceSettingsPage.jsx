import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import ActionSchedulesSection from './ActionSchedulesSection'
import TimeSelect from '../../components/ui/TimeSelect'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

export default function ComplianceSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { actionSchedules, fridgeCheckTime, saveActionSchedules, saveFridgeCheckTime } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div className="min-h-screen bg-surface">
      <SettingsSubHeader title="Compliance" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="px-4 pb-24 max-w-[480px] mx-auto">

        <div className="font-mono text-[10.5px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 pt-[18px] pb-[7px] px-0.5">Fridge checks</div>
        <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden">
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-charcoal tracking-[-0.005em]">Default check time</div>
              <div className="text-[11.5px] text-charcoal/50 mt-0.5 leading-[1.4]">When the daily fridge check is expected</div>
            </div>
            <div className="w-[120px] shrink-0">
              <TimeSelect value={fridgeCheckTime} onChange={saveFridgeCheckTime} />
            </div>
          </div>
        </div>

        <div className="font-mono text-[10.5px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 pt-[18px] pb-[7px] px-0.5">Daily action schedules</div>
        <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] px-[15px] pt-1 pb-2">
          <ActionSchedulesSection schedules={actionSchedules} onSave={saveActionSchedules} />
        </div>
        <div className="text-[11.5px] text-charcoal/50 pt-2 px-1 leading-[1.45]">
          Configure which compliance checks are active and on which days of the week they appear on the dashboard.
        </div>

      </div>
    </div>
  )
}
