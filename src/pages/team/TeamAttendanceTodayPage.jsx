import React from 'react'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAttendanceToday } from '../../hooks/useAttendanceToday'
import { useToast } from '../../components/ui/Toast'
import LoadError from '../../components/ui/LoadError'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'

const STATUS_TONE = {
  not_started: { bg: 'bg-surface dark:bg-white/8', text: 'text-charcoal/55 dark:text-white/40', label: 'Not started' },
  clocked_in:  { bg: 'bg-success/10', text: 'text-success', label: 'Clocked in' },
  on_break:    { bg: 'bg-warning/10', text: 'text-warning', label: 'On break' },
  clocked_out: { bg: 'bg-surface dark:bg-white/8', text: 'text-charcoal/55 dark:text-white/40', label: 'Clocked out' },
}

function StaffRow({ person }) {
  const tone = STATUS_TONE[person.status] ?? STATUS_TONE.not_started
  return (
    <div className="flex items-center gap-3 py-2.5 px-3.5">
      <Avatar name={person.name} id={person.staffId} colour={person.colour} photoUrl={person.photoUrl} size="md" decorative />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-charcoal dark:text-white truncate">{person.name}</span>
          {person.isLate && (
            <span className="inline-flex items-center gap-[4px] font-mono text-micro font-semibold text-danger uppercase tracking-[0.04em]">
              <span className="w-[5px] h-[5px] rounded-full bg-current" />
              Late
            </span>
          )}
        </div>
        <div className="text-micro text-charcoal/45 dark:text-white/35 truncate">
          {person.role ? `${person.role} · ` : ''}{person.startTime?.slice(0, 5)}–{person.endTime?.slice(0, 5)}
        </div>
      </div>
      <span className={`shrink-0 font-mono text-micro font-semibold uppercase tracking-[0.04em] px-2 py-1 rounded-full ${tone.bg} ${tone.text}`}>
        {tone.label}
      </span>
    </div>
  )
}

function LateRow({ entry, onAcknowledge, acknowledging }) {
  return (
    <div className="py-3 px-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-charcoal dark:text-white">{entry.name}</span>
        <span className="font-mono text-micro font-semibold text-danger">
          {entry.lateMins >= 1 ? `${entry.lateMins} min late` : '< 1 min late'}
        </span>
      </div>
      <div className="font-mono text-micro text-charcoal/45 dark:text-white/35">
        Scheduled {entry.scheduledTime} · Clocked in {entry.actualTime}
      </div>
      {entry.acknowledgedByName ? (
        <div className="font-mono text-micro text-success">
          Acknowledged by {entry.acknowledgedByName}
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          loading={acknowledging}
          onClick={() => onAcknowledge(entry)}
          disabled={acknowledging}
          className="self-start"
        >
          {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
        </Button>
      )}
    </div>
  )
}

export default function TeamAttendanceTodayPage() {
  const { venueId } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const { data, loading, error, refresh, acknowledgeLate } = useAttendanceToday(venueId)
  const [acknowledgingId, setAcknowledgingId] = React.useState(null)

  const now = new Date()
  const dayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })

  const roster = data?.roster ?? []
  const late = data?.late ?? []
  const onShiftCount = roster.filter(r => r.status === 'clocked_in' || r.status === 'on_break').length

  const ordered = [...roster].sort((a, b) => {
    const rank = { on_break: 0, clocked_in: 0, not_started: 1, clocked_out: 2 }
    return (rank[a.status] ?? 1) - (rank[b.status] ?? 1)
  })

  async function handleAcknowledge(entry) {
    if (!entry.clockEventId || acknowledgingId) return
    setAcknowledgingId(entry.clockEventId)
    const { error } = await acknowledgeLate(entry.clockEventId, session?.staffId)
    setAcknowledgingId(null)
    if (error) toast('Could not save acknowledgement', 'error')
  }

  return (
    <div className="pb-24">
      <div className="mb-4">
        <span className="font-mono text-micro text-charcoal/50 dark:text-white/40 tracking-[0.08em] uppercase">
          Attendance
        </span>
        <h1 className="text-display font-semibold tracking-[-0.028em] leading-[1.12] mt-1 mb-0 text-charcoal dark:text-white">
          {dayStr}
        </h1>
        {!loading && !error && (
          <p className="text-body-sm text-charcoal/45 dark:text-white/35 mt-1">
            {roster.length === 0
              ? 'No one scheduled today'
              : `${roster.length} scheduled · ${onShiftCount} on shift now${late.length > 0 ? ` · ${late.length} late` : ''}`}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[60px] rounded-xl bg-charcoal/6 dark:bg-white/8 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <LoadError what="today’s attendance" onRetry={refresh} />
      ) : (
        <>
          <div className="mb-5">
            <h2 className="font-mono text-micro font-semibold text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase mb-2">
              Working today
            </h2>
            {ordered.length === 0 ? (
              <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-xl px-3.5 py-6 text-center text-sm text-charcoal/40 dark:text-white/35">
                No shifts scheduled today
              </div>
            ) : (
              <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-xl divide-y divide-charcoal/6 dark:divide-white/8">
                {ordered.map(person => (
                  <StaffRow key={person.shiftId} person={person} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-mono text-micro font-semibold text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase mb-2">
              Late arrivals
            </h2>
            {late.length === 0 ? (
              <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-xl px-3.5 py-6 text-center text-sm text-charcoal/40 dark:text-white/35">
                No late arrivals today
              </div>
            ) : (
              <div className="bg-white dark:bg-paperDark border border-danger/20 rounded-xl divide-y divide-charcoal/6 dark:divide-white/8">
                {late.map(entry => (
                  <LateRow
                    key={entry.clockEventId ?? entry.staffId}
                    entry={entry}
                    onAcknowledge={handleAcknowledge}
                    acknowledging={acknowledgingId === entry.clockEventId}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
