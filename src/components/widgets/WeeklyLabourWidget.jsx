import React, { memo } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell } from './shared'

function weekStartStr() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  return format(monday, 'yyyy-MM-dd')
}

function WeeklyLabourWidget() {
  const { venueId } = useVenue()
  const weekStart = weekStartStr()

  const { data } = useWidgetQuery('weekly_labour', [venueId, weekStart], async () => {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('start_time, end_time, staff:staff_id(hourly_rate)')
        .eq('venue_id', venueId)
        .eq('week_start', weekStart)

      const items = shifts ?? []
      let totalHrs = 0
      let totalCost = 0
      for (const s of items) {
        if (!s.start_time || !s.end_time) continue
        const [sh, sm] = s.start_time.split(':').map(Number)
        const [eh, em] = s.end_time.split(':').map(Number)
        const hrs = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60)
        totalHrs += hrs
        totalCost += hrs * (s.staff?.hourly_rate ?? 0)
      }

      return { shifts: items.length, hours: totalHrs.toFixed(1), cost: totalCost.toFixed(2) }
  })

  if (!data) return <WidgetShell title="Weekly Labour" to="/rota"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  return (
    <WidgetShell title="Weekly Labour" to="/rota">
      <div className="text-center py-1">
        <p className="text-2xl font-bold font-bold text-charcoal font-mono">&pound;{data.cost}</p>
        <p className="text-xs text-charcoal/40 mt-0.5">{data.hours}h across {data.shifts} shifts</p>
      </div>
    </WidgetShell>
  )
}

export default memo(WeeklyLabourWidget)
