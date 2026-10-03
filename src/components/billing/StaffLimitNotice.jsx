/**
 * "4 of 5 staff" on Starter venues that are on self-serve billing. The limit
 * itself is enforced by the database (migration 138); this just makes it
 * visible before someone fills in the whole form.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import useBilling from '../../hooks/useBilling'

export default function StaffLimitNotice() {
  const { billing, staffLimit } = useBilling()
  const { venueSlug } = useVenue()
  const { isManager } = useSession()
  if (staffLimit == null || !billing) return null

  const used = billing.active_staff
  const full = used >= staffLimit

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 border ${full ? 'bg-warning/10 border-warning/25' : 'bg-charcoal/[0.03] dark:bg-white/5 border-charcoal/8 dark:border-white/10'}`}>
      <p className="text-[13px] text-charcoal/70 dark:text-white/60 leading-[1.4]">
        {full
          ? `You've used all ${staffLimit} staff included with Starter.`
          : `${used} of ${staffLimit} staff included with Starter.`}
      </p>
      {isManager && (
        <Link to={`/v/${venueSlug}/settings/billing`} className="shrink-0 text-[13px] font-semibold text-brand dark:text-accent">
          {full ? 'Upgrade to add more' : 'Go unlimited'}
        </Link>
      )}
    </div>
  )
}
