import React, { memo } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell } from './shared'

function StaffNotificationsWidget() {
  const { venueId, venueSlug } = useVenue()

  const { data } = useWidgetQuery('staff_notifications', [venueId], async () => {
    const [{ data: leave }, { data: swaps }, { count: trainCount }] = await Promise.all([
      supabase
        .from('time_off_requests')
        .select('id, start_date, end_date, reason, staff:staff_id(name)')
        .eq('venue_id', venueId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('shift_swaps')
        .select('id, requester_name, target_staff_name')
        .eq('venue_id', venueId)
        .eq('status', 'pending')
        .limit(5),
      supabase
        .from('training_sign_offs')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .eq('staff_acknowledged', false),
    ])
    return {
      leave:      leave  ?? [],
      swaps:      swaps  ?? [],
      trainCount: trainCount ?? 0,
    }
  })

  if (!data) {
    return (
      <WidgetShell title="Staff Notifications" to="/time-off">
        <div className="flex justify-center py-4"><LoadingSpinner /></div>
      </WidgetShell>
    )
  }

  const total = data.leave.length + data.swaps.length + data.trainCount
  const status = total > 0 ? 'warning' : undefined

  return (
    <WidgetShell title="Staff Notifications" status={status}>
      {total === 0 ? (
        <p className="text-sm text-charcoal/30 italic py-2">No pending notifications</p>
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          {data.leave.map(r => (
            <a
              key={r.id}
              href={`/v/${venueSlug}/time-off`}
              className="flex items-start gap-2 group"
            >
              <span className="text-warning text-xs mt-0.5 shrink-0">●</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal truncate group-hover:text-accent transition-colors">
                  {r.staff?.name ?? 'Staff'}: Leave Request
                </p>
                <p className="text-[11px] text-charcoal/40">
                  {format(new Date(r.start_date), 'd MMM')} – {format(new Date(r.end_date), 'd MMM yyyy')}
                  {r.reason ? ` · ${r.reason}` : ''}
                </p>
              </div>
            </a>
          ))}
          {data.swaps.map(s => (
            <a
              key={s.id}
              href={`/v/${venueSlug}/rota`}
              className="flex items-start gap-2 group"
            >
              <span className="text-accent text-xs mt-0.5 shrink-0">●</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal truncate group-hover:text-accent transition-colors">
                  Swap: {s.requester_name} → {s.target_staff_name}
                </p>
                <p className="text-[11px] text-charcoal/40">Shift swap pending approval</p>
              </div>
            </a>
          ))}
          {data.trainCount > 0 && (
            <a
              href={`/v/${venueSlug}/training`}
              className="flex items-start gap-2 group"
            >
              <span className="text-charcoal/40 text-xs mt-0.5 shrink-0">●</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal group-hover:text-accent transition-colors">
                  {data.trainCount} training record{data.trainCount !== 1 ? 's' : ''} unsigned
                </p>
                <p className="text-[11px] text-charcoal/40">Awaiting employee signature</p>
              </div>
            </a>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(StaffNotificationsWidget)
