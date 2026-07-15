import React, { memo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell, MiniRow } from './shared'
import { EXPLAINED_EXCEEDANCE_REASONS } from '../../lib/constants'

function FridgeAlertsWidget() {
  const { venueId, venueSlug } = useVenue()
  const { closedDays } = useAppSettings()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: raw } = useWidgetQuery('fridge_alerts', [venueId, today], async () => {
      const [{ data: closureRows }, { data: logs }, { data: fridges }] = await Promise.all([
        supabase
          .from('venue_closures')
          .select('id')
          .eq('venue_id', venueId)
          .lte('start_date', today)
          .gte('end_date', today)
          .limit(1),
        supabase
          .from('fridge_temperature_logs')
          .select('id, temperature, exceedance_reason, is_resolved, fridge:fridge_id(name, min_temp, max_temp)')
          .eq('venue_id', venueId)
          .gte('logged_at', today)
          .order('logged_at', { ascending: false }),
        supabase.from('fridges').select('id, name').eq('venue_id', venueId).eq('is_active', true),
      ])

      const items = logs ?? []
      const outOfRange = items.filter(l =>
        l.fridge &&
        (l.temperature < l.fridge.min_temp || l.temperature > l.fridge.max_temp) &&
        !EXPLAINED_EXCEEDANCE_REASONS.includes(l.exceedance_reason) &&
        !l.is_resolved
      )
      const checkedFridgeIds = new Set(items.map(l => l.fridge?.name).filter(Boolean))

      return {
        total: items.length,
        alerts: outOfRange.length,
        fridgeCount: fridges?.length ?? 0,
        checkedCount: checkedFridgeIds.size,
        hasClosure: (closureRows?.length ?? 0) > 0,
        alertItems: outOfRange.slice(0, 4),
      }
  })

  if (!raw) return <WidgetShell title="Fridge Status" to="/fridge"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  // Closed-day logic stays outside the query so a settings change applies
  // immediately without a refetch. closedDays: 0=Mon…6=Sun.
  const todayDow = (new Date().getDay() + 6) % 7
  const isClosed = closedDays.includes(todayDow) || raw.hasClosure
  // Don't flag unchecked fridges on closed days
  const unchecked = isClosed ? 0 : Math.max(0, raw.fridgeCount - raw.checkedCount)
  const data = { ...raw, isClosed, unchecked }

  const status = data.alerts > 0 ? 'bad' : data.unchecked > 0 ? 'warning' : 'good'

  return (
    <WidgetShell title="Fridge Status" to="/fridge" status={status}>
      <MiniRow label="Readings today" value={data.total} />
      <MiniRow label="Out of range" value={data.alerts} warn={data.alerts > 0} />
      {data.isClosed ? (
        <p className="text-[11px] text-charcoal/35 italic pt-1">Venue closed today — checks not required</p>
      ) : (
        <MiniRow label="Not yet checked" value={data.unchecked} warn={data.unchecked > 0} />
      )}
      {data.alerts > 0 && data.alertItems?.map((l) => (
        <Link
          key={l.id}
          to={`/v/${venueSlug}/fridge/history`}
          className="flex items-center justify-between py-1 border-t border-charcoal/5 group"
        >
          <span className="text-xs text-charcoal/60 truncate group-hover:text-charcoal transition-colors">{l.fridge?.name ?? 'Unknown'}</span>
          <span className="text-xs font-semibold text-danger">{Number(l.temperature).toFixed(1)} °C</span>
        </Link>
      ))}
    </WidgetShell>
  )
}

export default memo(FridgeAlertsWidget)
