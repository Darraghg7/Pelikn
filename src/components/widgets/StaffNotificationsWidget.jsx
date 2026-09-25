import React, { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { fetchTimeOffPrivateFields, withTimeOffPrivate } from '../../lib/api/timeOffPrivate'
import { fetchUnsignedTrainingCount, unsignedTrainingKey } from '../../lib/api/training'
import { decideTimeOff } from '../../lib/api/timeOffDecisions'
import { invalidateSummaryCache } from '../../hooks/useTodaySummary'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../ui/Toast'
import { useWidgetQuery } from '../../hooks/useWidgetQuery'
import LoadingSpinner from '../ui/LoadingSpinner'
import { WidgetShell } from './shared'

const LEAVE_NAMES = { annual: 'Annual leave', unpaid: 'Unpaid leave', other: 'Other leave' }

// "12 Dec 2026" for one day, "12–14 Dec 2026" within a month, else "30 Dec – 2 Jan 2027"
function leaveDates(r) {
  const start = parseISO(r.start_date), end = parseISO(r.end_date)
  if (r.start_date === r.end_date) return format(start, 'd MMM yyyy')
  if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) return `${format(start, 'd')}–${format(end, 'd MMM yyyy')}`
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
}

function Dot({ tone }) {
  const cls = { warn: 'bg-warn', info: 'bg-info', muted: 'bg-ink4' }[tone]
  return <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${cls}`} />
}

function StaffNotificationsWidget() {
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [deciding, setDeciding] = useState(null)   // request id being saved

  const { data } = useWidgetQuery('staff_notifications', [venueId], async () => {
    const [{ data: leave }, { data: swaps }, trainCount] = await Promise.all([
      supabase
        .from('time_off_requests')
        .select('id, staff_id, start_date, end_date, leave_type, staff:staff_id(name)')
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
      // Through the shared query key: the mobile dashboard shows the same
      // count, so whichever asks first fetches and the other reuses it.
      queryClient.fetchQuery({
        queryKey: unsignedTrainingKey(venueId),
        queryFn: () => fetchUnsignedTrainingCount(venueId),
        staleTime: 60_000,
      }),
    ])
    // 119 withholds `reason`; a manager gets the venue's, anyone else only
    // their own, so this widget still reads as it did for the people it is for.
    const leaveWithReasons = withTimeOffPrivate(leave ?? [], await fetchTimeOffPrivateFields())
    return {
      leave:      leaveWithReasons,
      swaps:      swaps  ?? [],
      trainCount: trainCount ?? 0,
    }
  })

  const decide = async (request, decision) => {
    setDeciding(request.id)
    const { error } = await decideTimeOff({ request, decision, reviewerId: session?.staffId, venueId })
    setDeciding(null)
    if (error) { toast(error.message, 'error'); return }
    toast(`${request.staff?.name ?? 'Leave'} ${decision === 'approved' ? 'approved' : 'rejected'}`)
    // Time off drives availability elsewhere — refresh what reads it
    queryClient.invalidateQueries({ queryKey: ['widget', 'staff_notifications'] })
    queryClient.invalidateQueries({ queryKey: ['availability'] })
    queryClient.invalidateQueries({ queryKey: ['calendar_staff_leave'] })
    invalidateSummaryCache(venueId)
  }

  if (!data) {
    return (
      <WidgetShell title="Staff notifications" to="/time-off">
        <div className="flex justify-center py-3"><LoadingSpinner /></div>
      </WidgetShell>
    )
  }

  const total = data.leave.length + data.swaps.length + (data.trainCount > 0 ? 1 : 0)
  const aside = total > 0 && <span className="shrink-0 font-mono text-[13px] text-ink3 dark:text-white/45">{total} new</span>

  return (
    <WidgetShell title="Staff notifications" aside={aside} flush={total > 0}>
      {total === 0 ? (
        <p className="text-[13px] text-ink3 dark:text-white/45 py-2">No pending notifications</p>
      ) : (
        <div className="divide-y divide-line dark:divide-white/10">
          {data.leave.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 sm:px-4 py-2.5">
              <Dot tone="warn" />
              {/* Buttons drop below the text when the card is too narrow for both */}
              <Link to={`/v/${venueSlug}/time-off`} className="flex-1 min-w-[170px]">
                <p className="text-[14px] leading-snug font-semibold text-ink dark:text-white">{r.staff?.name ?? 'Staff'} · leave request</p>
                <p className="text-[13px] text-ink3 dark:text-white/45 mt-0.5">
                  {LEAVE_NAMES[r.leave_type] ?? 'Leave'} · {leaveDates(r)}{r.reason ? ` · ${r.reason}` : ''}
                </p>
              </Link>
              <div className="shrink-0 flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => decide(r, 'rejected')}
                  disabled={deciding === r.id}
                  className="h-9 px-2.5 min-[420px]:px-3 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-[13px] min-[420px]:text-[13px] font-semibold text-bad dark:text-[#f19a86] hover:border-bad/40 disabled:opacity-40"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => decide(r, 'approved')}
                  disabled={deciding === r.id}
                  className="h-9 px-2.5 min-[420px]:px-3 rounded-xl bg-brand text-white text-[13px] min-[420px]:text-[13px] font-semibold hover:bg-brand/90 disabled:opacity-40"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
          {data.swaps.map(s => (
            <Link key={s.id} to={`/v/${venueSlug}/rota`} className="flex items-center gap-3 px-4 sm:px-4 py-2.5 hover:bg-cream/60 dark:hover:bg-white/5">
              <Dot tone="info" />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] leading-snug font-semibold text-ink dark:text-white">{s.requester_name} wants to swap a shift</span>
                <span className="block text-[13px] text-ink3 dark:text-white/45 mt-0.5">With {s.target_staff_name} · needs approval on the rota</span>
              </span>
              <svg className="shrink-0 w-4 h-4 text-ink3 dark:text-white/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          ))}
          {data.trainCount > 0 && (
            <Link to={`/v/${venueSlug}/training`} className="flex items-center gap-3 px-4 sm:px-4 py-2.5 hover:bg-cream/60 dark:hover:bg-white/5">
              <Dot tone="muted" />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink dark:text-white">
                  {data.trainCount} training record{data.trainCount !== 1 ? 's' : ''} unsigned
                </span>
                <span className="block text-[13px] text-ink3 dark:text-white/45">Awaiting employee signature</span>
              </span>
              <svg className="shrink-0 w-4 h-4 text-ink3 dark:text-white/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(StaffNotificationsWidget)
