/**
 * Locks a venue whose free trial has ended (or whose subscription has lapsed)
 * until the owner picks a plan. Plan & Billing itself stays open so they can.
 *
 * Fails open: while billing is loading, unknown or unmanaged, the app renders
 * as normal (see billingAccess in lib/billing.ts).
 */
import React from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import useBilling from '../../hooks/useBilling'
import Button from '../ui/Button'

const COPY = {
  trial_ended: {
    title: 'Your free trial has ended',
    body: 'Choose a plan to keep using Pelikn. Your records are safe and everything is exactly where you left it.',
  },
  payment_failed: {
    title: "We couldn't take payment",
    body: 'Update your card in Plan & Billing to carry on. Your records are safe.',
  },
  cancelled: {
    title: 'Your subscription has ended',
    body: 'Restart your plan any time to pick up where you left off. Your records are safe.',
  },
}

export default function RequireBilling({ children }) {
  const { access } = useBilling()
  const { pathname } = useLocation()
  const { venueSlug } = useParams()
  const { venueName } = useVenue()
  const { isManager, signOut } = useSession()

  if (access.state !== 'locked' || pathname.endsWith('/settings/billing')) return children

  const copy = COPY[access.reason]

  return (
    <div className="min-h-dvh bg-surface font-sans flex flex-col items-center justify-center px-5 py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-brand dark:text-accent" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <p className="text-micro tracking-widest uppercase font-semibold text-charcoal/40 dark:text-white/40 mb-2">{venueName}</p>
      <h1 className="text-xl font-bold text-charcoal dark:text-white mb-2">{copy.title}</h1>
      <p className="text-sm text-charcoal/55 dark:text-white/50 max-w-sm leading-relaxed mb-8">
        {isManager ? copy.body : 'Pelikn is paused for this venue until the owner chooses a plan. Let your manager know.'}
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {isManager && (
          <Link
            to={`/v/${venueSlug}/settings/billing`}
            className="bg-brand text-cream py-3 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
          >
            {access.reason === 'payment_failed' ? 'Update payment' : 'Choose a plan'}
          </Link>
        )}
        <Button
          variant="secondary"
          fullWidth
          onClick={signOut}
        >
          Sign out
        </Button>
      </div>
      <p className="text-xs text-charcoal/35 dark:text-white/30 mt-6">
        Questions? <a href="mailto:hello@get-pelikn.com" className="text-brand dark:text-accent">hello@get-pelikn.com</a>
      </p>
    </div>
  )
}
