import React, { memo } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell } from './shared'
import { londonToday } from '../../lib/time'

function StaffOnShiftWidget() {
  const { venueId } = useVenue()
  const today = londonToday()

  const { data } = useWidgetQuery('staff_on_shift', [venueId, today], async () => {
    const { data: rows } = await supabase.from('shifts')
      .select('id, start_time, end_time, role_label, staff:staff_id(name)')
      .eq('venue_id', venueId)
      .eq('shift_date', today)
      .order('start_time')
    return rows ?? []
  })

  const shifts = data ?? []
  const loading = !data
  const now = format(new Date(), 'HH:mm')

  const title = loading ? 'On shift today' : `On shift today · ${shifts.length}`

  return (
    <WidgetShell title={title} to="/rota" linkLabel="Rota" flush={!loading && shifts.length > 0}>
      {loading ? (
        <div className="flex justify-center py-2.5"><LoadingSpinner /></div>
      ) : shifts.length === 0 ? (
        <p className="text-[13px] text-ink3 dark:text-white/45 py-2">No shifts today</p>
      ) : (
        <div className="divide-y divide-line dark:divide-white/10">
          {shifts.slice(0, 5).map(s => {
            const start = s.start_time?.slice(0, 5) ?? ''
            const end = s.end_time?.slice(0, 5) ?? ''
            const active = now >= start && now <= end
            const name = s.staff?.name ?? '—'
            const parts = name.trim().split(/\s+/)
            const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.charAt(0)
            // green = on shift now, amber = later today, grey = finished
            const dot = active ? 'bg-good' : now > end ? 'bg-ink4' : 'bg-warn'
            return (
              <div key={s.id} className="flex items-center gap-2.5 px-3.5 sm:px-3.5 py-2">
                <span className="relative shrink-0 w-9 h-9 rounded-full bg-brand-tint dark:bg-white/10 inline-flex items-center justify-center text-[13px] font-semibold text-ink dark:text-white">
                  {letters.toUpperCase()}
                  <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-paperDark ${dot}`} title={active ? 'On shift now' : now > end ? 'Finished' : 'Later today'} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink dark:text-white truncate">{name}</p>
                  {s.role_label && <p className="text-[13px] text-ink3 dark:text-white/45 truncate">{s.role_label}</p>}
                </div>
                <p className="shrink-0 font-mono text-[13px] font-semibold text-ink2 dark:text-white/75">{start}–{end}</p>
              </div>
            )
          })}
          {shifts.length > 5 && (
            <p className="text-[13px] text-ink3 dark:text-white/45 px-3.5 sm:px-3.5 py-2.5">+{shifts.length - 5} more on the rota</p>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(StaffOnShiftWidget)
