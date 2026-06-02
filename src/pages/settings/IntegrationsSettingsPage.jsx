import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'

const MC = {
  brand: '#13362a', brandTint: '#f0f7f4',
  ink:   '#111827', ink3: '#6b7280', ink4: '#9ca3af',
  line:  '#e5e7eb', line2: '#f3f4f6',
  paper: '#ffffff',
  warn:  '#d97706', warnBg: '#fffbeb',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

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
    <div style={{ padding: '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>

      <button onClick={() => navigate(vp('/settings/hub'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: MC.brand, fontSize: 14, fontWeight: 500 }}>
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Integrations</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Connect Pelikn to your other tools</div>
      </div>

      {/* Coming soon banner */}
      <div style={{ background: MC.brandTint, border: `1px solid ${MC.brand}22`, borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: MC.brand, marginBottom: 4 }}>Integrations launching soon</div>
        <div style={{ fontSize: 13, color: MC.ink3, lineHeight: 1.5 }}>
          We're building native connections to payroll, rota, and comms tools. Want to vote on what comes first?
        </div>
        <a
          href="mailto:hello@pelikn.com?subject=Integration request"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            height: 34, padding: '0 14px', borderRadius: 8,
            background: MC.brand, color: '#fff', textDecoration: 'none',
            fontSize: 13, fontWeight: 600,
          }}
        >
          Request an integration →
        </a>
      </div>

      {/* Integration cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {INTEGRATIONS.map(item => (
          <div
            key={item.id}
            style={{
              background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14,
              padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 13,
              opacity: 0.65,
            }}
          >
            <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: MC.ink }}>{item.name}</div>
              <div style={{ fontSize: 12, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>{item.description}</div>
            </div>
            <span style={{
              flexShrink: 0, padding: '3px 9px', borderRadius: 999,
              background: MC.line2,
              fontFamily: MONO, fontSize: 9.5, fontWeight: 600,
              color: MC.ink4, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>Soon</span>
          </div>
        ))}
      </div>

    </div>
  )
}
