import React, { memo } from 'react'
import { format } from 'date-fns'
import { fetchTodaysDeliveriesWidget } from '../../lib/api/widgets'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import { WidgetShell, MiniRow, WidgetPending } from './shared'

function TodaysDeliveriesWidget() {
  const { venueId } = useVenue()
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const { data, isError, refetch } = useWidgetQuery('todays_deliveries', [venueId, todayStr], () => fetchTodaysDeliveriesWidget(venueId))

  if (!data) return <WidgetShell title="Today's Deliveries" to="/deliveries"><WidgetPending isError={isError} onRetry={refetch} /></WidgetShell>

  const status = data.fails > 0 ? 'bad' : data.total > 0 ? 'good' : 'neutral'

  return (
    <WidgetShell title="Today's Deliveries" to="/deliveries" status={status !== 'neutral' ? status : undefined}>
      {data.total === 0 ? (
        <p className="text-sm text-charcoal/30 dark:text-white/30 italic py-2">No deliveries logged today</p>
      ) : (
        <>
          <MiniRow label="Deliveries" value={data.total} />
          <MiniRow label="Failed" value={data.fails} warn={data.fails > 0} />
          <div className="mt-2 border-t border-charcoal/6 dark:border-white/8 pt-2">
            {data.items.map(c => (
              <div key={c.id} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-charcoal/60 dark:text-white/50 truncate">{c.supplier_name}</span>
                <span className={`text-micro font-medium ${c.overall_pass ? 'text-success' : 'text-danger'}`}>
                  {c.overall_pass ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  )
}

export default memo(TodaysDeliveriesWidget)
