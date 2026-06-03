import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import HelpSection from './HelpSection'

const MC = {
  brand: '#13362a',
  ink:   '#111827', ink3: '#6b7280',
}

export default function HelpSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ padding: '16px 0 96px', maxWidth: 480, margin: '0 auto' }}>

      <button onClick={() => navigate(vp('/settings/hub'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: MC.brand, fontSize: 14, fontWeight: 500 }}>
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M1 1l4 4-4 4"/></svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Help & Support</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>FAQs, docs & contact</div>
      </div>

      <HelpSection />

    </div>
  )
}
