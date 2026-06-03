import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAppSettings } from '../../hooks/useSettings'
import NotificationsPanel from './NotificationsPanel'

const MC = {
  brand: '#13362a',
  good:  '#16a34a',
  ink:   '#111827', ink3: '#6b7280',
  line:  '#e5e7eb', line2: '#f3f4f6',
  paper: '#ffffff',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{ width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: on ? MC.good : MC.line, position: 'relative', transition: 'background .18s', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(9,18,13,0.25)', transition: 'left .18s' }} />
    </button>
  )
}

export default function NotificationsSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { session } = useSession()
  const { pushToManager, savePushToManager } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ padding: '16px 0 96px', maxWidth: 480, margin: '0 auto' }}>

      <button onClick={() => navigate(vp('/settings/hub'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: MC.brand, fontSize: 14, fontWeight: 500 }}>
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Notifications</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Alerts, push notifications & digest</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Escalation push */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>Attendance alerts</div>
          <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink, letterSpacing: '-0.005em' }}>Push on escalation</div>
                <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>Send a notification when an attendance strike is escalated to manager</div>
              </div>
              <Toggle on={pushToManager} onClick={() => savePushToManager(!pushToManager)} />
            </div>
          </div>
        </div>

        {/* Per-type notification preferences */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>Push notification preferences</div>
          <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, padding: '0 15px' }}>
            <NotificationsPanel session={session} settings={{}} />
          </div>
        </div>

      </div>
    </div>
  )
}
