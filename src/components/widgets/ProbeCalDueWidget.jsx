import React, { memo } from 'react'
import { format } from 'date-fns'
import { fetchProbeCalibrationWidget } from '../../lib/api/widgets'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import { WidgetShell, MiniRow, WidgetPending } from './shared'

function ProbeCalDueWidget() {
  const { venueId } = useVenue()

  const { data, isError, refetch } = useWidgetQuery('probe_calibration', [venueId], () => fetchProbeCalibrationWidget(venueId))

  if (!data) return <WidgetShell title="Probe Calibration" to="/probe"><WidgetPending isError={isError} onRetry={refetch} /></WidgetShell>

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
