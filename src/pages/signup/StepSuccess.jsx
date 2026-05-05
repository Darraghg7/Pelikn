import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSpark, IconArrow } from './SignupIcons'

export default function StepSuccess({ venueName, venueSlug, plan, allVenues = [] }) {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(`/v/${venueSlug}`)
    }, 6000)
    return () => clearTimeout(timer)
  }, [venueSlug, navigate])

  return (
    <div className="flex flex-col items-center text-center max-w-sm mx-auto gap-6">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-success/8 border-4 border-success/20 flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-2">You're all set!</h1>
        <p className="text-sm text-charcoal/50 leading-relaxed">
          {allVenues.length > 1
            ? `${allVenues.length} venues are ready on Pelikn.`
            : <><strong className="text-charcoal">{venueName}</strong> is ready on Pelikn.</>
          }
          {' '}Your 7-day free trial has started — no payment needed yet.
        </p>
      </div>

      {/* Plan badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border ${
        plan === 'pro'
          ? 'bg-accent/10 text-accent border-accent/20'
          : 'bg-success/8 text-brand border-success/30'
      }`}>
        <IconSpark />
        {plan === 'pro' ? 'Pro Plan' : 'Starter Plan'} · 7-day free trial
      </div>

      {/* Venue URL(s) */}
      {allVenues.length > 1 ? (
        <div className="w-full bg-charcoal/4 rounded-xl px-4 py-3 flex flex-col gap-2">
          <p className="text-[11px] text-charcoal/40 tracking-widest uppercase mb-1">Your staff login URLs</p>
          {allVenues.map(v => (
            <div key={v.slug} className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-charcoal/70 truncate">{v.name}</p>
              <p className="text-xs font-mono text-charcoal/50 shrink-0">pelikn.app/v/{v.slug}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full bg-charcoal/4 rounded-xl px-4 py-3">
          <p className="text-[11px] text-charcoal/40 tracking-widest uppercase mb-1">Your staff login URL</p>
          <p className="text-xs font-mono text-charcoal/60">pelikn.app/v/{venueSlug}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => navigate(`/v/${venueSlug}`)}
          className="w-full bg-brand text-cream py-3.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors flex items-center justify-center gap-2"
        >
          Go to your dashboard
          <IconArrow />
        </button>
        <p className="text-[11px] text-charcoal/35">Redirecting automatically in a few seconds…</p>
      </div>
    </div>
  )
}
