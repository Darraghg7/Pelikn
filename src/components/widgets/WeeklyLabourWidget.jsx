import React, { memo } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { fetchStaffPayRates } from '../../lib/api/staffRestricted'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import { useAppSettings } from '../../hooks/useSettings'
import { paidShiftHours } from '../../hooks/useShifts'
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
  const { breakDurationMins } = useAppSettings()

  const { data } = useWidgetQuery('weekly_labour', [venueId, weekStart, breakDurationMins], async () => {
      // hourly_rate is no longer readable from the staff table (117), so the
      // rates come from staff_pay_rates instead. A non-manager gets only their
      // own rate back, which means this widget shows them their own cost
      // rather than the venue's — it is registered as a manager widget.
      const [{ data: shifts }, rates] = await Promise.all([
        supabase
          .from('shifts')
          .select('start_time, end_time, staff_id, staff:staff_id(is_under_18)')
          .eq('venue_id', venueId)
          .eq('week_start', weekStart),
        fetchStaffPayRates(),
      ])

      const items = shifts ?? []
      let totalHrs = 0
      let totalCost = 0
      for (const s of items) {
        if (!s.start_time || !s.end_time) continue
        // Paid hours, as on the rota and timesheets: unpaid break deducted,
        // and shifts that finish after midnight counted (this used to clamp
        // them to 0 and count the full span including the break).
        const hrs = paidShiftHours(s.start_time, s.end_time, s.staff?.is_under_18 ?? false, breakDurationMins)
        totalHrs += hrs
        totalCost += hrs * (rates.get(s.staff_id) ?? 0)
      }

      return { shifts: items.length, hours: totalHrs.toFixed(1), cost: totalCost.toFixed(2) }
  })

  if (!data) return <WidgetShell title="Weekly Labour" to="/rota"><div className="flex justify-center py-4"><LoadingSpinner /></div></WidgetShell>

  return (
    <WidgetShell title="Weekly Labour" to="/rota">
      <div className="text-center py-1">
        <p className="text-2xl font-bold font-bold text-charcoal dark:text-white font-mono">&pound;{data.cost}</p>
        <p className="text-xs text-charcoal/40 dark:text-white/35 mt-0.5">{data.hours}h across {data.shifts} shifts</p>
      </div>
    </WidgetShell>
  )
}

export default memo(WeeklyLabourWidget)
