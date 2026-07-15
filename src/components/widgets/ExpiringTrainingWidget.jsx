import React, { memo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell, MiniRow } from './shared'

function ExpiringTrainingWidget() {
  const { venueId, venueSlug } = useVenue()

  const { data } = useWidgetQuery('expiring_training', [venueId], async () => {
    const { data: certs } = await supabase.from('staff_training')
      .select('id, title, expiry_date, staff:staff_id(name)')
      .eq('venue_id', venueId)
      .not('expiry_date', 'is', null)
      .order('expiry_date')
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 86400000)
    const items = certs ?? []
    const expired = items.filter(c => new Date(c.expiry_date) < now)
    const expiring = items.filter(c => {
      const d = new Date(c.expiry_date)
      return d >= now && d <= thirtyDays
    })
    return { expired: expired.length, expiring: expiring.length, items: [...expired, ...expiring].slice(0, 4) }
  })

  if (!data) return <WidgetShell title="Training Expiry" to="/training"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  const status = data.expired > 0 ? 'bad' : data.expiring > 0 ? 'warning' : 'good'

  return (
    <WidgetShell title="Training Expiry" to="/training" status={status}>
      <MiniRow label="Expired" value={data.expired} warn={data.expired > 0} />
      <MiniRow label="Expiring (30 days)" value={data.expiring} warn={data.expiring > 0} />
      {data.items.length > 0 && (
        <div className="mt-2 border-t border-charcoal/6 pt-2">
          {data.items.map(c => (
            <Link key={c.id} to={`/v/${venueSlug}/training`} className="flex items-center justify-between py-0.5 hover:text-charcoal transition-colors group">
              <span className="text-xs text-charcoal/50 truncate group-hover:text-charcoal">{c.staff?.name} — {c.title}</span>
              <span className={`text-[11px] font-semibold ml-2 shrink-0 ${new Date(c.expiry_date) < new Date() ? 'text-danger' : 'text-warning'}`}>
                {format(new Date(c.expiry_date), 'd MMM yy')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(ExpiringTrainingWidget)
