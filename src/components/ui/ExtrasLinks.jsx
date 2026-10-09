import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { getExtraFeature } from '../../lib/features'

/**
 * A short list of the optional extras this venue has switched on, for the
 * phone hubs (the desktop rail lists them itself). Renders nothing when none
 * of `ids` are on.
 */
export default function ExtrasLinks({ ids, className = '' }) {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { isEnabled } = useVenueFeatures()
  const extras = ids.filter(isEnabled).map(getExtraFeature).filter(Boolean)
  if (extras.length === 0) return null

  return (
    <div className={className}>
      <div className="font-mono text-micro font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 px-0.5 pb-1.5">Extras</div>
      <div className="rounded-xl border border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark overflow-hidden divide-y divide-charcoal/6 dark:divide-white/8">
        {extras.map(f => (
          <button
            key={f.id}
            onClick={() => navigate(`/v/${venueSlug}${f.path}`)}
            className="w-full text-left cursor-pointer bg-transparent px-[14px] py-[12px] flex items-center gap-[10px]"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-charcoal dark:text-white tracking-[-0.01em]">{f.label}</div>
              <div className="text-caption text-charcoal/50 dark:text-white/40 mt-[1px]">{f.description}</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30 dark:text-white/30 shrink-0">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
