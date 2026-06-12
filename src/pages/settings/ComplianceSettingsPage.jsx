import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import ActionSchedulesSection from './ActionSchedulesSection'
import TimeSelect from '../../components/ui/TimeSelect'

const MC = {
  brand: '#13362a', brandTint: '#eef4f0',
  ink:   '#0d1a14', ink3: '#76817b', ink4: '#b3b9b5',
  line:  '#e4e6e2', line2: '#eef0ec',
  paper: '#ffffff', bg: '#f3f3ef',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function SubHeader({ title, onBack }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'rgba(243,243,239,0.92)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `1px solid ${MC.line}`,
      padding: '12px 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: MC.brand, background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px 0', fontFamily: SANS, fontSize: 15, fontWeight: 500,
      }}>
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L1.5 7.5 8 14"/>
        </svg>
        Settings
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: MC.ink }}>{title}</span>
      <span style={{ width: 70 }} />
    </div>
  )
}

export default function ComplianceSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { actionSchedules, fridgeCheckTime, saveActionSchedules, saveFridgeCheckTime } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ minHeight: '100vh', background: MC.bg, fontFamily: SANS }}>
      <SubHeader title="Compliance" onBack={() => navigate(vp('/settings/hub'))} />

      <div style={{ padding: '0 16px 96px', maxWidth: 480, margin: '0 auto' }}>

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '18px 2px 7px' }}>Fridge checks</div>
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink, letterSpacing: '-0.005em' }}>Default check time</div>
              <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>When the daily fridge check is expected</div>
            </div>
            <div style={{ width: 120, flexShrink: 0 }}>
              <TimeSelect value={fridgeCheckTime} onChange={saveFridgeCheckTime} />
            </div>
          </div>
        </div>

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '18px 2px 7px' }}>Daily action schedules</div>
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, padding: '4px 15px 8px' }}>
          <ActionSchedulesSection schedules={actionSchedules} onSave={saveActionSchedules} />
        </div>
        <div style={{ fontSize: 11.5, color: MC.ink3, padding: '8px 4px 0', lineHeight: 1.45 }}>
          Configure which compliance checks are active and on which days of the week they appear on the dashboard.
        </div>

      </div>
    </div>
  )
}
