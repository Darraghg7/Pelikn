import React, { memo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import { WidgetShell, MiniRow, WidgetPending } from './shared'
import { EXPLAINED_EXCEEDANCE_REASONS } from '../../lib/constants'

function FridgeAlertsWidget() {
  const { venueId, venueSlug } = useVenue()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: raw, isError, refetch } = useWidgetQuery('fridge_alerts', [venueId, today], async () => {
      const [{ data: logs, error: logsError }, { data: fridges, error: fridgesError }] = await Promise.all([
        supabase
          .from('fridge_temperature_logs')
          .select('id, temperature, exceedance_reason, is_resolved, fridge:fridge_id(name, min_temp, max_temp)')
          .eq('venue_id', venueId)
          .gte('logged_at', today)
          .order('logged_at', { ascending: false }),
        supabase.from('fridges').select('id, name').eq('venue_id', venueId).eq('is_active', true),
      ])
      if (logsError || fridgesError) throw logsError ?? fridgesError

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
        alertItems: outOfRange.slice(0, 4),
      }
  })

  if (!raw) return <WidgetShell title="Fridges" to="/fridge"><WidgetPending isError={isError} onRetry={refetch} className="py-2.5" /></WidgetShell>

  // Fridge checks run on their own action_schedule and aren't blanked out by
  // trading closure — staff can still be scheduled to record them on a day
  // the venue isn't open to customers. See useTodaySummary.js / useChecksStatus.js.
  const unchecked = Math.max(0, raw.fridgeCount - raw.checkedCount)
  const data = { ...raw, unchecked }

  return (
    <WidgetShell title="Fridges" to="/fridge">
      <MiniRow label="Readings today" value={data.total} />
      <MiniRow label="Out of range" value={data.alerts} warn={data.alerts > 0} good={data.alerts === 0} />
      <MiniRow label="Not checked" value={data.unchecked} warn={data.unchecked > 0} good={data.unchecked === 0} />
      {data.alerts > 0 && data.alertItems?.map((l) => (
        <Link
          key={l.id}
          to={`/v/${venueSlug}/fridge/history`}
          className="flex items-center justify-between gap-2 py-1.5 border-t border-line dark:border-white/10 group"
        >
          <span className="text-body-sm text-ink2 dark:text-white/70 truncate group-hover:text-ink dark:group-hover:text-white transition-colors">{l.fridge?.name ?? 'Unknown'}</span>
          <span className="font-mono text-body-sm font-semibold text-bad dark:text-badDark">{Number(l.temperature).toFixed(1)}°C</span>
        </Link>
      ))}
    </WidgetShell>
  )
}

export default memo(FridgeAlertsWidget)
