import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import ActionSchedulesSection from './ActionSchedulesSection'
import TimeSelect from '../../components/ui/TimeSelect'

const MC = {
  brand: '#13362a',
  ink:   '#111827', ink3: '#6b7280',
  line:  '#e5e7eb',
  paper: '#ffffff',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

export default function ComplianceSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { actionSchedules, fridgeCheckTime, saveActionSchedules, saveFridgeCheckTime } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ padding: '16px 0 96px', maxWidth: 480, margin: '0 auto' }}>

      <button onClick={() => navigate(vp('/settings/hub'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: MC.brand, fontSize: 14, fontWeight: 500 }}>
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Compliance</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Daily check schedules & fridge timing</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Fridge check time */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>Fridge checks</div>
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
        </div>

        {/* Action schedules */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>Daily action schedules</div>
          <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, padding: '4px 15px 8px' }}>
            <ActionSchedulesSection schedules={actionSchedules} onSave={saveActionSchedules} />
          </div>
          <div style={{ fontSize: 11.5, color: MC.ink3, padding: '8px 4px 0', lineHeight: 1.45 }}>
            Configure which compliance checks are active and on which days of the week they appear on the dashboard.
          </div>
        </div>

      </div>
    </div>
  )
}
