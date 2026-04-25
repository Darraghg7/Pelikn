import React from 'react'
import { Link } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'

export function WidgetShell({ title, to, children, status }) {
  const { venueSlug } = useVenue()
  const statusDot = { good: 'bg-success', warning: 'bg-warning', bad: 'bg-danger' }
  const href = to && venueSlug ? `/v/${venueSlug}${to}` : to
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {status && <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[status] ?? 'bg-charcoal/20'}`} />}
          <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/50">{title}</p>
        </div>
        {href && (
          <Link to={href} className="text-[11px] font-bold tracking-wide text-brand/60 hover:text-brand transition-colors">
            VIEW &rsaquo;
          </Link>
        )}
      </div>
      <div className="px-5 pb-4">{children}</div>
    </div>
  )
}

export function BigNumber({ value, label, alert }) {
  return (
    <div className="py-1">
      <p className={`text-3xl font-bold ${alert ? 'text-danger' : 'text-charcoal'}`}>{value}</p>
      {label && <p className="text-xs text-charcoal/40 mt-0.5">{label}</p>}
    </div>
  )
}

export function MiniRow({ label, value, warn }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-charcoal/60">{label}</span>
      <span className={`text-sm font-semibold ${warn ? 'text-danger' : 'text-charcoal'}`}>{value}</span>
    </div>
  )
}
