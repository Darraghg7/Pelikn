import React, { memo } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell, MiniRow } from './shared'

function ProbeCalDueWidget() {
  const { venueId } = useVenue()

  const { data } = useWidgetQuery('probe_calibration', [venueId], async () => {
    const { data: records } = await supabase.from('probe_calibrations')
      .select('id, probe_name, pass, calibrated_at')
      .eq('venue_id', venueId)
      .order('calibrated_at', { ascending: false })
      .limit(10)
    const items = records ?? []
    const last = items[0]
    const daysSince = last
      ? Math.floor((new Date() - new Date(last.calibrated_at)) / 86400000)
      : null
    const recentFails = items.filter(r => !r.pass).length
    return { daysSince, recentFails, lastDate: last ? format(new Date(last.calibrated_at), 'd MMM') : 'Never' }
  })

  if (!data) return <WidgetShell title="Probe Calibration" to="/probe"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  const status = data.daysSince === null || data.daysSince > 30 ? 'warning' : data.recentFails > 0 ? 'bad' : 'good'

  return (
    <WidgetShell title="Probe Calibration" to="/probe" status={status}>
      <MiniRow label="Last calibration" value={data.lastDate} />
      <MiniRow
        label="Days since"
        value={data.daysSince ?? '-'}
        warn={data.daysSince !== null && data.daysSince > 30}
      />
      <MiniRow label="Recent failures" value={data.recentFails} warn={data.recentFails > 0} />
    </WidgetShell>
  )
}

export default memo(ProbeCalDueWidget)
