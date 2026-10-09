/**
 * Dashboard nudge for managers when the free trial is nearly over or a
 * payment has failed. Says nothing the rest of the time.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import useBilling from '../../hooks/useBilling'

const SHOW_WHEN_DAYS_LEFT = 3

export default function TrialBanner({ venueSlug }) {
  const { access } = useBilling()

  let message = null
  if (access.state === 'trial' && access.daysLeft <= SHOW_WHEN_DAYS_LEFT) {
    const when = access.daysLeft <= 1 ? 'today' : `on ${format(new Date(access.endsAt), 'EEEE d MMMM')}`
    message = `Your free trial ends ${when}. Add a card to keep everything running.`
  } else if (access.state === 'past_due') {
    message = "Your last payment didn't go through. Update your card to keep Pelikn running."
  }
  if (!message) return null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-warning/10 border border-warning/25 rounded-xl px-4 py-3">
      <p className="text-body-sm text-charcoal/75 dark:text-white/70 flex-1 leading-[1.5]">{message}</p>
      <Link
        to={`/v/${venueSlug}/settings/billing`}
        className="self-start sm:self-auto shrink-0 inline-flex items-center h-9 px-4 rounded-[9px] bg-brand text-cream text-body-sm font-semibold"
      >
        {access.state === 'past_due' ? 'Update card' : 'Choose a plan'}
      </Link>
    </div>
  )
}
