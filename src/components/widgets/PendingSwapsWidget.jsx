import React, { memo } from 'react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell, BigNumber } from './shared'

function PendingSwapsWidget() {
  const { venueId } = useVenue()

  const { data } = useWidgetQuery('pending_swaps', [venueId], async () => {
    const { data: swaps } = await supabase.from('shift_swaps')
      .select('id, requester_name, target_staff_name, status')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .limit(5)
    return { items: swaps ?? [], count: swaps?.length ?? 0 }
  })

  if (!data) return <WidgetShell title="Swap Requests" to="/rota"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  return (
    <WidgetShell title="Swap Requests" to="/rota" status={data.count > 0 ? 'warning' : undefined}>
      {data.count === 0 ? (
        <p className="text-sm text-charcoal/30 italic py-2">No pending requests</p>
      ) : (
        <>
          <BigNumber value={data.count} label="pending" alert={false} />
          <div className="mt-1 border-t border-charcoal/6 pt-2">
            {data.items.map(s => (
              <p key={s.id} className="text-xs text-charcoal/50 py-0.5 truncate">
                {s.requester_name} → {s.target_staff_name}
              </p>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  )
}

export default memo(PendingSwapsWidget)
