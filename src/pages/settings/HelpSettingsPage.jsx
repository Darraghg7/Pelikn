import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'

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

const FAQS = [
  { q: 'How do I publish the rota?', a: 'Once all shifts are added, tap "Publish rota" — staff are notified immediately via push.' },
  { q: 'Can staff see their own shifts?', a: 'Yes. Staff see their own schedule and logged hours. Managers see the full team view with costs.' },
  { q: 'How does auto-fill work?', a: 'Auto-fill assigns available staff to open shifts based on role and station. Always review before publishing.' },
  { q: 'How do I reset a staff PIN?', a: 'Go to Staff & Roles → tap the person → Reset PIN. They set a new one on next login.' },
  { q: 'Can I manage multiple venues?', a: 'Yes on the Pro plan. Switch venues from the account menu at the top.' },
  { q: 'How do compliance checks work?', a: 'Checks appear on the dashboard each day based on your action schedule. Staff complete them during their shift and results are logged automatically.' },
]

export default function HelpSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const [expanded, setExpanded] = useState(null)

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ minHeight: '100vh', background: MC.bg, fontFamily: SANS }}>
      <SubHeader title="Help & Support" onBack={() => navigate(vp('/settings/hub'))} />

      <div style={{ padding: '0 16px 96px', maxWidth: 480, margin: '0 auto' }}>

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '18px 2px 7px' }}>Common questions</div>
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${MC.line2}` : 'none' }}>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{
                  width: '100%', padding: '14px', textAlign: 'left', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, fontFamily: SANS,
                }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 500, color: MC.ink, lineHeight: 1.3 }}>{faq.q}</span>
                <span style={{ transform: expanded === i ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={MC.ink4} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 1l4 4-4 4"/>
                  </svg>
                </span>
              </button>
              {expanded === i && (
                <div style={{ padding: '0 14px 14px', fontFamily: MONO, fontSize: 11.5, color: MC.ink3, lineHeight: 1.65 }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '18px 2px 7px' }}>Get help</div>
        <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <a
            href="mailto:hello@pelikn.com"
            style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '0 14px', minHeight: 58,
              borderBottom: `1px solid ${MC.line2}`, textDecoration: 'none',
            }}
          >
            <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: MC.brandTint, color: MC.brand, display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: MC.ink }}>Chat with support</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, marginTop: 2 }}>Usually responds in under an hour</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={MC.ink4} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </a>
          <a
            href="https://docs.pelikn.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '0 14px', minHeight: 58,
              textDecoration: 'none',
            }}
          >
            <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: MC.brandTint, color: MC.brand, display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6M9 13h6M9 17h4"/>
              </svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: MC.ink }}>View documentation</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, marginTop: 2 }}>Guides, tutorials, release notes</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke={MC.ink4} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </a>
        </div>

      </div>
    </div>
  )
}
