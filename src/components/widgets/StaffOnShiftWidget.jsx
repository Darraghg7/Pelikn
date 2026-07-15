import React, { memo } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell } from './shared'

function StaffOnShiftWidget() {
  const { venueId } = useVenue()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data } = useWidgetQuery('staff_on_shift', [venueId, today], async () => {
    const { data: rows } = await supabase.from('shifts')
      .select('id, start_time, end_time, role_label, staff:staff_id(name, job_role)')
      .eq('venue_id', venueId)
      .eq('shift_date', today)
      .order('start_time')
    return rows ?? []
  })

  const shifts = data ?? []
  const loading = !data
  const now = format(new Date(), 'HH:mm')

  return (
    <WidgetShell title="On Shift Today" to="/rota">
      {loading ? (
        <div className="flex justify-center py-4"><LoadingSpinner /></div>
      ) : shifts.length === 0 ? (
        <p className="text-sm text-charcoal/30 italic py-2">No shifts today</p>
      ) : (
        <div className="flex flex-col divide-y divide-charcoal/6 -mx-5">
          {shifts.slice(0, 5).map(s => {
            const start = s.start_time?.slice(0, 5) ?? ''
            const end = s.end_time?.slice(0, 5) ?? ''
            const active = now >= start && now <= end
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-success' : now > end ? 'bg-charcoal/20' : 'bg-warning'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{s.staff?.name ?? '—'}</p>
                  <p className="text-[11px] text-charcoal/40">{s.role_label}</p>
                </div>
                <p className="text-xs font-mono text-charcoal/50">{start}–{end}</p>
              </div>
            )
          })}
          {shifts.length > 5 && (
            <p className="text-[11px] text-charcoal/30 px-5 py-2">+{shifts.length - 5} more</p>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(StaffOnShiftWidget)
