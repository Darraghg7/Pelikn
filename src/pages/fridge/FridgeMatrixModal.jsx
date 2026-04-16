import React, { useMemo, useState } from 'react'
import { format, subDays, eachDayOfInterval, parseISO, isWithinInterval } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { useAppSettings } from '../../hooks/useSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import { useFridgeMatrix } from '../../hooks/useFridgeLogs'
import { isTempOutOfRange, formatTemp } from '../../lib/utils'
import Modal from '../../components/ui/Modal'

const RANGE_OPTIONS = [
  { id: 7,  label: '7 days'  },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
]

const EXCEEDANCE_REASONS = [
  { id: 'delivery',       label: 'Delivery / restocking', explained: true  },
  { id: 'defrost',        label: 'Defrost cycle',         explained: true  },
  { id: 'service_access', label: 'Busy service access',   explained: true  },
  { id: 'equipment',      label: 'Equipment concern',     explained: false },
  { id: 'other',          label: 'Other reason',          explained: false },
]

// Returns a Set of yyyy-MM-dd strings for every day in [dateFrom..dateTo]
// that the venue is closed — either by weekly schedule or by a venue_closures
// range. Used to grey-out cells in the matrix.
function buildClosedDateSet({ dateFrom, dateTo, closedDays, closures }) {
  const out = new Set()
  const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) })
  for (const d of days) {
    // date-fns getDay: 0=Sun..6=Sat. Settings store 0=Mon..6=Sun, so convert.
    const jsDay = d.getDay()
    const settingsDay = (jsDay + 6) % 7
    if (closedDays.includes(settingsDay)) {
      out.add(format(d, 'yyyy-MM-dd'))
      continue
    }
    for (const c of closures) {
      if (isWithinInterval(d, { start: parseISO(c.start_date), end: parseISO(c.end_date) })) {
        out.add(format(d, 'yyyy-MM-dd'))
        break
      }
    }
  }
  return out
}

/* ── Backfill record modal ────────────────────────────────────────────────── */
function BackfillModal({ open, onClose, fridge, dateStr, period, onSaved }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()

  const [temp, setTemp]       = useState('')
  const [time, setTime]       = useState(period === 'pm' ? '15:00' : '10:00')
  const [reason, setReason]   = useState(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving]   = useState(false)

  // Reset state every time the modal opens for a new cell
  React.useEffect(() => {
    if (open) {
      setTemp('')
      setTime(period === 'pm' ? '15:00' : '10:00')
      setReason(null)
      setComment('')
    }
  }, [open, period])

  if (!fridge || !dateStr) return null

  const parsedTemp     = temp === '' ? null : parseFloat(temp)
  const outOfRange     = parsedTemp !== null && isTempOutOfRange(parsedTemp, fridge.min_temp, fridge.max_temp)
  const selectedReason = EXCEEDANCE_REASONS.find(r => r.id === reason)
  const isExplained    = selectedReason?.explained ?? false
  const needsNote      = reason !== null && !isExplained
  const canSave =
    parsedTemp !== null &&
    !Number.isNaN(parsedTemp) &&
    (!outOfRange || (reason !== null && (isExplained || comment.trim().length >= 5)))

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)

    // Combine the chosen date + time as a local-timezone ISO string so the
    // log appears in the same calendar day in the matrix.
    const [hh, mm] = time.split(':').map(Number)
    const dt = parseISO(dateStr)
    dt.setHours(hh ?? 12, mm ?? 0, 0, 0)

    const { error } = await supabase.from('fridge_temperature_logs').insert({
      fridge_id:         fridge.id,
      fridge_name:       fridge.name,
      temperature:       parsedTemp,
      logged_by:         session?.staffId,
      logged_by_name:    session?.staffName ?? 'Unknown',
      notes:             comment.trim() || null,
      logged_at:         dt.toISOString(),
      check_period:      period,
      venue_id:          venueId,
      exceedance_reason: reason ?? null,
      follow_up_due_at:  null, // backfill — no live follow-up needed
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Saved ${formatTemp(parsedTemp)} for ${format(dt, 'd MMM')} ${period.toUpperCase()}`)
    onSaved()
    onClose()
  }

  const headerDate = format(parseISO(dateStr), 'EEEE, d MMM yyyy')

  return (
    <Modal open={open} onClose={onClose} title="Record missed reading">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-cream/50 border border-charcoal/10 px-4 py-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">{period.toUpperCase()} check</p>
          <p className="text-sm font-semibold text-charcoal mt-0.5">{fridge.name}</p>
          <p className="text-xs text-charcoal/50 mt-0.5">{headerDate}</p>
          <p className="text-[11px] text-charcoal/40 mt-0.5">Safe: {fridge.min_temp}–{fridge.max_temp}°C</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Temperature (°C)</label>
            <input
              type="number" step="0.1" min="-30" max="60"
              value={temp}
              onChange={e => setTemp(e.target.value)}
              placeholder="e.g. 3.5"
              className={[
                'w-full px-3 py-2.5 rounded-lg border bg-cream/30 focus:outline-none focus:ring-2',
                'text-lg font-mono text-charcoal placeholder-charcoal/20',
                outOfRange ? 'border-warning/50 focus:ring-warning/20' : 'border-charcoal/15 focus:ring-charcoal/20',
              ].join(' ')}
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Time taken</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
        </div>

        {outOfRange && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-warning">⚠</span>
              <p className="text-xs font-semibold text-charcoal">Above safe range — what's the reason?</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {EXCEEDANCE_REASONS.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setReason(r.id); setComment('') }}
                  className={[
                    'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all',
                    reason === r.id
                      ? r.explained
                        ? 'bg-warning/15 border-warning/40 text-charcoal'
                        : 'bg-danger/8 border-danger/25 text-charcoal'
                      : 'bg-white border-charcoal/12 text-charcoal/60 hover:border-charcoal/25 hover:text-charcoal',
                  ].join(' ')}
                >
                  <span>{r.label}</span>
                  {r.explained && <span className="text-[10px] tracking-wide text-success font-semibold">No penalty</span>}
                </button>
              ))}
            </div>
            {reason && needsNote && (
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Describe the corrective action taken…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white focus:outline-none focus:ring-2 focus:ring-danger/20 text-sm resize-none"
              />
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!canSave || saving}
            className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Reading →'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50"
          >
            Cancel
          </button>
        </div>

        <p className="text-[11px] text-charcoal/35 leading-relaxed">
          Backfilled readings are flagged in your audit log with the time you choose above and the staff member currently signed in.
        </p>
      </div>
    </Modal>
  )
}

/* ── Matrix view modal ───────────────────────────────────────────────────── */
export default function FridgeMatrixModal({ open, onClose }) {
  const [rangeDays, setRangeDays] = useState(7)

  const dateTo   = format(new Date(), 'yyyy-MM-dd')
  const dateFrom = format(subDays(new Date(), rangeDays - 1), 'yyyy-MM-dd')

  const { fridges, matrix, loading, reload } = useFridgeMatrix(dateFrom, dateTo)
  const { closedDays } = useAppSettings()
  const { closures }   = useVenueClosures()

  const [backfillTarget, setBackfillTarget] = useState(null) // { fridge, dateStr, period }

  const days = useMemo(() => {
    if (!open) return []
    return eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) })
  }, [open, dateFrom, dateTo])

  const closedSet = useMemo(
    () => buildClosedDateSet({ dateFrom, dateTo, closedDays, closures }),
    [dateFrom, dateTo, closedDays, closures]
  )

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const renderCell = (fridge, dateStr, period) => {
    const isClosed = closedSet.has(dateStr)
    const log      = matrix[fridge.id]?.[dateStr]?.[period] ?? null
    const isFuture = dateStr > todayStr

    if (isClosed) {
      return (
        <td className="text-center px-1 py-1.5 bg-charcoal/5">
          <span className="text-[10px] tracking-wide uppercase text-charcoal/30">Closed</span>
        </td>
      )
    }

    if (log) {
      const oor = isTempOutOfRange(log.temperature, fridge.min_temp, fridge.max_temp)
      const explained = log.exceedance_reason && ['delivery','defrost','service_access'].includes(log.exceedance_reason)
      const colour = !oor ? 'text-success' : explained ? 'text-warning' : 'text-danger'
      return (
        <td className="text-center px-1 py-1.5">
          <button
            type="button"
            onClick={() => setBackfillTarget({ fridge, dateStr, period })}
            className="inline-flex flex-col items-center gap-0 hover:underline underline-offset-2"
            title={`Logged ${format(new Date(log.logged_at), 'HH:mm')} by ${log.logged_by_name ?? 'Unknown'} — click to add another reading`}
          >
            <span className={`font-mono text-xs font-semibold ${colour}`}>{formatTemp(log.temperature)}</span>
            {oor && explained && (
              <span className="text-[8px] tracking-wide uppercase text-warning/80 font-semibold">Expl.</span>
            )}
          </button>
        </td>
      )
    }

    if (isFuture) {
      return <td className="text-center px-1 py-1.5"><span className="text-charcoal/15 text-xs">—</span></td>
    }

    // Missing reading — make it clickable to backfill
    return (
      <td className="text-center px-1 py-1.5 bg-warning/5">
        <button
          type="button"
          onClick={() => setBackfillTarget({ fridge, dateStr, period })}
          className="text-[10px] tracking-wide uppercase font-semibold text-warning/70 hover:text-warning underline underline-offset-2"
        >
          + Add
        </button>
      </td>
    )
  }

  return (
    <>
      <Modal open={open && !backfillTarget} onClose={onClose} title="Fridge Temperature Matrix">
        <div className="flex flex-col gap-4 -mx-2">
          <div className="px-2 flex items-center justify-between gap-3">
            <p className="text-xs text-charcoal/50">
              Click any missed reading to backfill. Closed days are greyed out.
            </p>
            <div className="flex items-center gap-1.5">
              {RANGE_OPTIONS.map(o => (
                <button
                  key={o.id}
                  onClick={() => setRangeDays(o.id)}
                  className={[
                    'px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                    rangeDays === o.id
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                  ].join(' ')}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-charcoal/40 italic px-2 py-6 text-center">Loading…</p>
          ) : fridges.length === 0 ? (
            <p className="text-sm text-charcoal/40 italic px-2 py-6 text-center">
              No fridges set up yet.
            </p>
          ) : (
            <div className="overflow-x-auto px-2 max-h-[60dvh]">
              <table className="text-xs border-collapse min-w-full">
                <thead className="sticky top-0 bg-cream z-10">
                  <tr>
                    <th className="text-left text-[11px] tracking-widest uppercase text-charcoal/40 font-medium pb-2 pr-3 sticky left-0 bg-cream">
                      Fridge
                    </th>
                    {days.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd')
                      const isClosed = closedSet.has(dateStr)
                      return (
                        <th
                          key={dateStr}
                          colSpan={2}
                          className={`text-center text-[10px] tracking-wide font-medium pb-1 px-1 border-l border-charcoal/8 ${isClosed ? 'text-charcoal/30' : 'text-charcoal/60'}`}
                        >
                          <div>{format(d, 'd MMM')}</div>
                          <div className="text-[9px] text-charcoal/35">{format(d, 'EEE')}</div>
                        </th>
                      )
                    })}
                  </tr>
                  <tr>
                    <th className="sticky left-0 bg-cream pb-2"></th>
                    {days.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd')
                      return (
                        <React.Fragment key={dateStr + '-h'}>
                          <th className="text-[9px] tracking-widest uppercase text-charcoal/30 font-medium pb-2 px-1 border-l border-charcoal/8">AM</th>
                          <th className="text-[9px] tracking-widest uppercase text-charcoal/30 font-medium pb-2 px-1">PM</th>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/6">
                  {fridges.map(f => (
                    <tr key={f.id}>
                      <td className="text-xs pr-3 py-1.5 sticky left-0 bg-cream">
                        <p className="font-medium text-charcoal whitespace-nowrap">{f.name}</p>
                        <p className="text-[10px] text-charcoal/40">{f.min_temp}–{f.max_temp}°C</p>
                      </td>
                      {days.map(d => {
                        const dateStr = format(d, 'yyyy-MM-dd')
                        return (
                          <React.Fragment key={f.id + dateStr}>
                            {renderCell(f, dateStr, 'am')}
                            {renderCell(f, dateStr, 'pm')}
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-charcoal/40">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-charcoal/5 border border-charcoal/10" />
              Closed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-warning/5 border border-warning/30" />
              Missed — click to add
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-success" />
              In range
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-warning" />
              Explained
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-danger" />
              Out of range
            </span>
          </div>
        </div>
      </Modal>

      <BackfillModal
        open={!!backfillTarget}
        onClose={() => setBackfillTarget(null)}
        fridge={backfillTarget?.fridge}
        dateStr={backfillTarget?.dateStr}
        period={backfillTarget?.period}
        onSaved={reload}
      />
    </>
  )
}
