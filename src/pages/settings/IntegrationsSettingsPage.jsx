import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

const INTEGRATIONS = [
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sync timesheets and payroll data to your Xero account.',
    icon: '🔵',
    status: 'coming_soon',
  },
  {
    id: 'deputy',
    name: 'Deputy',
    description: 'Import rotas and staff from Deputy.',
    icon: '🟡',
    status: 'coming_soon',
  },
  {
    id: 'rotacloud',
    name: 'RotaCloud',
    description: 'Sync your RotaCloud schedule with Pelikn.',
    icon: '🟢',
    status: 'coming_soon',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send compliance alerts and check reminders to a Slack channel.',
    icon: '💬',
    status: 'coming_soon',
  },
]

export default function IntegrationsSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div>
      <SettingsSubHeader title="Integrations" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="pb-24 max-w-[480px] mx-auto pt-4">

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-charcoal dark:text-white m-0">Integrations</h1>
        <div className="text-xs text-charcoal/50 dark:text-white/40 mt-1">Connect Pelikn to your other tools</div>
      </div>

      <div className="bg-brand/8 border border-brand/[0.13] rounded-[14px] px-4 py-[14px] mb-4">
        <div className="text-sm font-semibold text-brand mb-1">Integrations launching soon</div>
        <div className="text-[13px] text-charcoal/50 dark:text-white/40 leading-[1.5]">
          We're building native connections to payroll, rota, and comms tools. Want to vote on what comes first?
        </div>
        <a
          href="mailto:hello@pelikn.com?subject=Integration request"
          className="inline-flex items-center gap-1.5 mt-3 h-[34px] px-[14px] rounded-lg bg-brand text-white no-underline text-[13px] font-semibold"
        >
          Request an integration →
        </a>
      </div>

      <div className="flex flex-col gap-[9px]">
        {INTEGRATIONS.map(item => (
          <div
            key={item.id}
            className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[14px] px-[15px] py-[14px] flex items-center gap-[13px] opacity-65"
          >
            <span className="text-[28px] shrink-0 leading-none">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-charcoal dark:text-white">{item.name}</div>
              <div className="text-xs text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">{item.description}</div>
            </div>
            <span className="shrink-0 py-[3px] px-[9px] rounded-full bg-charcoal/6 dark:bg-white/8 font-mono text-[11px] font-semibold text-charcoal/30 dark:text-white/30 tracking-[0.05em] uppercase">Soon</span>
          </div>
        ))}
      </div>

      </div>
    </div>
  )
}
