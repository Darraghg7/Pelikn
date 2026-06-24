import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

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
    <div className="min-h-screen bg-surface">
      <SettingsSubHeader title="Help & Support" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="px-4 pb-24 max-w-[480px] mx-auto">

        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 pt-[18px] pb-[7px] px-0.5">Common questions</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] overflow-hidden">
          {FAQS.map((faq, i) => (
            <div key={i} className={i < FAQS.length - 1 ? 'border-b border-charcoal/6' : ''}>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full p-[14px] text-left flex items-center justify-between gap-3"
              >
                <span className="text-[14.5px] font-medium text-charcoal leading-[1.3]">{faq.q}</span>
                <span className={`transition-transform duration-200 shrink-0 ${expanded === i ? 'rotate-90' : ''}`}>
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30">
                    <path d="M1 1l4 4-4 4"/>
                  </svg>
                </span>
              </button>
              {expanded === i && (
                <div className="px-[14px] pb-[14px] font-mono text-[11.5px] text-charcoal/50 leading-[1.65]">{faq.a}</div>
              )}
            </div>
          ))}
        </div>

        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 pt-[18px] pb-[7px] px-0.5">Get help</div>
        <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-[14px] overflow-hidden">
          <a
            href="mailto:hello@pelikn.com"
            className="flex items-center gap-[13px] px-[14px] min-h-[58px] border-b border-charcoal/6 no-underline"
          >
            <span className="w-8 h-8 rounded-[9px] shrink-0 bg-brand/8 text-brand flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium text-charcoal">Chat with support</div>
              <div className="font-mono text-[11px] text-charcoal/50 mt-0.5">Usually responds in under an hour</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </a>
          <a
            href="https://docs.pelikn.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[13px] px-[14px] min-h-[58px] no-underline"
          >
            <span className="w-8 h-8 rounded-[9px] shrink-0 bg-brand/8 text-brand flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6M9 13h6M9 17h4"/>
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium text-charcoal">View documentation</div>
              <div className="font-mono text-[11px] text-charcoal/50 mt-0.5">Guides, tutorials, release notes</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </a>
        </div>

      </div>
    </div>
  )
}
