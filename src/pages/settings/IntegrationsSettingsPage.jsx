import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'

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
    <div className="pb-24 max-w-[480px] mx-auto px-0 pt-4">

      <button onClick={() => navigate(vp('/settings/hub'))} className="inline-flex items-center gap-1.5 mb-4 text-brand text-sm font-medium">
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-charcoal m-0">Integrations</h1>
        <div className="text-xs text-charcoal/50 mt-1">Connect Pelikn to your other tools</div>
      </div>

      <div className="bg-brand/8 border border-brand/[0.13] rounded-[14px] px-4 py-[14px] mb-4">
        <div className="text-sm font-semibold text-brand mb-1">Integrations launching soon</div>
        <div className="text-[13px] text-charcoal/50 leading-[1.5]">
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
            className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] px-[15px] py-[14px] flex items-center gap-[13px] opacity-65"
          >
            <span className="text-[28px] shrink-0 leading-none">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-charcoal">{item.name}</div>
              <div className="text-xs text-charcoal/50 mt-0.5 leading-[1.4]">{item.description}</div>
            </div>
            <span className="shrink-0 py-[3px] px-[9px] rounded-full bg-charcoal/6 font-mono text-[9.5px] font-semibold text-charcoal/30 tracking-[0.05em] uppercase">Soon</span>
          </div>
        ))}
      </div>

    </div>
  )
}
