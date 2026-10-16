import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSpark, IconArrow } from './SignupIcons'
import Button from '../../components/ui/Button'
import { HEADLINE, LABEL } from './styles'

export default function StepSuccess({ venueName, venueSlug, plan, allVenues = [] }) {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(`/v/${venueSlug}`)
    }, 6000)
    return () => clearTimeout(timer)
  }, [venueSlug, navigate])

  return (
    <div className="flex flex-col gap-8 w-full max-w-xl">
      <div className="w-20 h-20 rounded-full bg-brand text-cream flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div>
        <h1 className="text-charcoal" style={HEADLINE}>You're all set.</h1>
        <p className="text-title-sm sm:text-title text-charcoal/75 mt-6 leading-[1.4]">
          {allVenues.length > 1
            ? `${allVenues.length} venues are ready on Pelikn.`
            : <><strong className="font-medium text-charcoal">{venueName}</strong> is ready on Pelikn.</>
          }
          {' '}Your 7-day free trial has started. Add a card in Plan &amp; Billing whenever you're ready.
        </p>
      </div>

      <div className={`self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-body font-medium ${
        plan === 'pro' ? 'bg-accent text-cream' : 'bg-brand text-cream'
      }`}>
        <IconSpark />
        {plan === 'pro' ? 'Pro plan' : 'Starter plan'} · 7-day free trial
      </div>

      {/* Venue URL(s) */}
      {allVenues.length > 1 ? (
        <div className="w-full bg-paper rounded-sheet p-6 sm:p-8 flex flex-col gap-3">
          <p className={`${LABEL} mb-1`}>Your staff login URLs</p>
          {allVenues.map(v => (
            <div key={v.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-body-lg font-medium truncate">{v.name}</p>
              <p className="text-body font-mono text-charcoal/75 shrink-0">get-pelikn.com/v/{v.slug}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full bg-paper rounded-sheet p-6 sm:p-8">
          <p className={`${LABEL} mb-2`}>Your staff login URL</p>
          <p className="text-title-sm font-mono break-all">get-pelikn.com/v/{venueSlug}</p>
        </div>
      )}

      {/* Email verification nudge */}
      <div className="w-full flex items-start gap-4 px-1">
        <svg className="shrink-0 mt-1 text-charcoal/70" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
        <p className="text-body-lg text-charcoal/75 leading-[1.5]">
          We've sent a verification email to your inbox. Click the link to confirm your account. You can still use Pelikn in the meantime.
        </p>
      </div>

      <div>
        <Button pill size="lg" onClick={() => navigate(`/v/${venueSlug}`)} className="px-8">
          Go to your dashboard
          <IconArrow />
        </Button>
        <p className="text-body-sm text-charcoal/70 mt-4">Redirecting automatically in a few seconds…</p>
      </div>
    </div>
  )
}
