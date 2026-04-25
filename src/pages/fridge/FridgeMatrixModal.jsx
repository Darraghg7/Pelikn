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

function buildClosedDateSet({ dateFrom, dateTo, closedDays, closures }) {
  const out = new Set()
  const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) })
  for (const d of days) {
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
      follow_up_due_at:  null,
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
        <div className="rounded-2xl bg-white border border-charcoal/10 px-4 py-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">{period.toUpperCase()} check</p>
          <p className="text-sm font-semibold text-charcoal mt-0.5">{fridge.name}</p>
          <p className="text-xs text-charcoal/50 mt-0.5">{headerDate}</p>
          <p className="text-[11px] text-charcoal/40 mt-0.5">Safe range: {fridge.min_temp}–{fridge.max_temp}°C</p>
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
                'w-full px-3 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2',
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
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
        </div>

        {outOfRange && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-warning">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <p className="text-xs font-semibold text-charcoal">Above safe range — what's the reason?</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {EXCEEDANCE_REASONS.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setReason(r.id); setComment('') }}
                  className={[
                    'flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all',
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
                className="w-full px-3 py-2 rounded-xl border border-charcoal/15 bg-white focus:outline-none focus:ring-2 focus:ring-danger/20 text-sm resize-none"
              />
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!canSave || saving}
            className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Reading →'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:border-charcoal/30 transition-colors"
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

  const [backfillTarget, setBackfillTarget] = useState(null)

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
        <td className="text-center px-2 py-4 bg-charcoal/4 border-r border-charcoal/6 last:border-r-0">
          <span className="text-[10px] tracking-widest uppercase text-charcoal/25 font-medium">Closed</span>
        </td>
      )
    }

    if (log) {
      const oor      = isTempOutOfRange(log.temperature, fridge.min_temp, fridge.max_temp)
      const explained = log.exceedance_reason && ['delivery','defrost','service_access'].includes(log.exceedance_reason)
      const colour   = !oor ? 'text-success' : explained ? 'text-warning' : 'text-danger'
      return (
        <td className="text-center px-2 py-4 border-r border-charcoal/6 last:border-r-0">
          <button
            type="button"
            onClick={() => setBackfillTarget({ fridge, dateStr, period })}
            className="inline-flex flex-col items-center gap-0.5 hover:opacity-70 transition-opacity"
            title={`Logged ${format(new Date(log.logged_at), 'HH:mm')} by ${log.logged_by_name ?? 'Unknown'} — click to add another reading`}
          >
            <span className={`font-mono text-sm font-bold ${colour}`}>{formatTemp(log.temperature)}</span>
            {oor && explained && (
              <span className="text-[9px] tracking-wide uppercase text-warning/70 font-semibold">Expl.</span>
            )}
          </button>
        </td>
      )
    }

    if (isFuture) {
      return (
        <td className="text-center px-2 py-4 border-r border-charcoal/6 last:border-r-0">
          <span className="text-charcoal/15 text-sm">—</span>
        </td>
      )
    }

    return (
      <td className="text-center px-2 py-4 bg-warning/4 border-r border-charcoal/6 last:border-r-0">
        <button
          type="button"
          onClick={() => setBackfillTarget({ fridge, dateStr, period })}
          className="text-[11px] tracking-wide uppercase font-semibold text-warning hover:text-warning/70 transition-colors"
        >
          + Add
        </button>
      </td>
    )
  }

  return (
    <>
      <Modal open={open && !backfillTarget} onClose={onClose} title="Fridge Temperature Matrix" size="xl">
        <div className="flex flex-col gap-5">

          {/* Controls row */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-charcoal/50">
              Click any missed reading to backfill. Closed days are greyed out.
            </p>
            <div className="flex items-center gap-1 bg-charcoal/6 rounded-full p-1 shrink-0">
              {RANGE_OPTIONS.map(o => (
                <button
                  key={o.id}
                  onClick={() => setRangeDays(o.id)}
                  className={[
                    'px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
                    rangeDays === o.id
                      ? 'bg-charcoal text-cream shadow-sm'
                      : 'text-charcoal/50 hover:text-charcoal',
                  ].join(' ')}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 border-t-charcoal animate-spin mx-auto" />
            </div>
          ) : fridges.length === 0 ? (
            <p className="text-sm text-charcoal/40 py-12 text-center">No fridges set up yet.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden">
              <div className="overflow-x-auto max-h-[55dvh] overflow-y-auto">
                <table className="text-xs border-collapse w-full">
                  <thead className="sticky top-0 bg-white z-10">
                    {/* Date row */}
                    <tr className="border-b border-charcoal/8">
                      <th className="text-left text-[11px] tracking-widest uppercase text-charcoal/40 font-medium py-3 px-5 sticky left-0 bg-white min-w-[160px]">
                        Fridge
                      </th>
                      {days.map(d => {
                        const dateStr  = format(d, 'yyyy-MM-dd')
                        const isClosed = closedSet.has(dateStr)
                        const isToday  = dateStr === todayStr
                        return (
                          <th
                            key={dateStr}
                            colSpan={2}
                            className={`text-center py-3 px-2 border-l border-charcoal/8 min-w-[100px] ${isClosed ? 'bg-charcoal/3' : ''}`}
                          >
                            <div className={`text-xs font-semibold ${isToday ? 'text-brand' : isClosed ? 'text-charcoal/30' : 'text-charcoal'}`}>
                              {format(d, 'd MMM')}
                            </div>
                            <div className={`text-[10px] mt-0.5 ${isClosed ? 'text-charcoal/25' : 'text-charcoal/40'}`}>
                              {format(d, 'EEE')}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                    {/* AM / PM sub-header */}
                    <tr className="border-b border-charcoal/8">
                      <th className="sticky left-0 bg-white py-2 px-5" />
                      {days.map(d => {
                        const dateStr  = format(d, 'yyyy-MM-dd')
                        const isClosed = closedSet.has(dateStr)
                        return (
                          <React.Fragment key={dateStr + '-ampm'}>
                            <th className={`text-[10px] tracking-widest uppercase text-charcoal/35 font-medium py-2 px-2 border-l border-charcoal/8 ${isClosed ? 'bg-charcoal/3' : ''}`}>
                              AM
                            </th>
                            <th className={`text-[10px] tracking-widest uppercase text-charcoal/35 font-medium py-2 px-2 border-r border-charcoal/8 ${isClosed ? 'bg-charcoal/3' : ''}`}>
                              PM
                            </th>
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/6">
                    {fridges.map(f => (
                      <tr key={f.id} className="hover:bg-charcoal/1 transition-colors">
                        <td className="px-5 py-4 sticky left-0 bg-white border-r border-charcoal/8">
                          <p className="font-semibold text-charcoal text-sm whitespace-nowrap">{f.name}</p>
                          <p className="text-[11px] text-charcoal/40 mt-0.5">{f.min_temp}–{f.max_temp}°C</p>
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
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-charcoal/50">
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-md bg-charcoal/5 border border-charcoal/10" />
              Closed
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-md bg-warning/5 border border-warning/25" />
              Missed — click to add
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-success" />
              In range
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning" />
              Explained
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-danger" />
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
