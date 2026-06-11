import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAppSettings } from '../../hooks/useSettings'
import NotificationsPanel from './NotificationsPanel'

const MC = {
  brand: '#13362a', brandTint: '#eef4f0',
  good:  '#1a7a4c',
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

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{ width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: on ? MC.brand : MC.line, position: 'relative', transition: 'background .18s', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(9,18,13,0.25)', transition: 'left .18s' }} />
    </button>
  )
}

export default function NotificationsSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { session } = useSession()
  const { pushToManager, savePushToManager, notifyBreakOverrun, saveNotifyBreakOverrun } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ minHeight: '100vh', background: MC.bg, fontFamily: SANS }}>
      <SubHeader title="Notifications" onBack={() => navigate(vp('/settings/hub'))} />

      <div style={{ padding: '0 16px 96px', maxWidth: 480, margin: '0 auto' }}>

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '14px 2px 7px' }}>Attendance alerts</div>
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderBottom: `1px solid ${MC.line2}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink, letterSpacing: '-0.005em' }}>Lateness escalation</div>
              <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>Notify manager when an attendance strike threshold is reached</div>
            </div>
            <Toggle on={pushToManager} onClick={() => savePushToManager(!pushToManager)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink, letterSpacing: '-0.005em' }}>Break overrun</div>
              <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>Notify manager when a staff member exceeds their allowed break time</div>
            </div>
            <Toggle on={notifyBreakOverrun} onClick={() => saveNotifyBreakOverrun(!notifyBreakOverrun)} />
          </div>
        </div>

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '14px 2px 7px' }}>Push notification preferences</div>
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden', padding: '14px 16px' }}>
          <NotificationsPanel session={session} settings={{}} />
        </div>

      </div>
    </div>
  )
}
