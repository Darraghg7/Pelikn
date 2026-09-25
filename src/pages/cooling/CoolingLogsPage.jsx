/**
 * CoolingLogsPage — cook-chill records. UK guidance: cooked food must drop to
 * 8°C or below within 90 minutes.
 *
 * A batch is started when it goes into the chiller (start temp, time, method)
 * and finished when the end temperature is taken. Batches still cooling live in
 * the database with no end_temp (migration 120), so every device in the
 * kitchen sees the same timers and anyone can finish one.
 *
 * Tabs:
 *   - Log: batches cooling now, the start form, and today's finished batches
 *   - History: pass rate, average time and failures, one card per day
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, subDays, isToday } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useCoolingLogs, useCoolingInProgress, useFrequentCoolingItems } from '../../hooks/useCoolingLogs'
import {
  COOLING_TARGET_TEMP, COOLING_TARGET_MINUTES, COOLING_METHODS,
  coolingMethodLabel, coolingOutcome, formatCoolingMinutes,
} from '../../lib/cooling'
import {
  CARD, TONE, PageHeader, TabBar, ReadingInput, SectionHeading, QuickPicks, TempField, TimeOfDayField, useTimeOfDay,
  FIELD_LABEL, TEXT_FIELD,
} from '../../components/temperature/TempPageParts'
import { HistoryRangePills, StatStrip, DayCard, formatPct, historyDateFrom, groupByDay } from '../../components/temperature/TempHistoryView'
import CoolingExportModal from './CoolingExportModal'

const NEW_METHODS = COOLING_METHODS.filter(m => !m.legacy)

function StopwatchIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="14" r="8" /><polyline points="12 10 12 14 14.5 15.5" /><line x1="10" y1="2" x2="14" y2="2" />
    </svg>
  )
}

function temp(value) {
  return `${Number(value).toFixed(1).replace(/\.0$/, '')}°`
}

// "from 20:05", or "from Wed 20:05" for a batch started on an earlier day
function startedLabel(startedAt) {
  const d = new Date(startedAt)
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'EEE HH:mm')
}

/* ── A batch that's cooling right now ─────────────────────────────────────── */
function CoolingBatchCard({ batch, now, canDiscard, onChanged, onDiscard }) {
  const toast = useToast()
  const [endTemp, setEndTemp] = useState('')
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)

  const elapsed  = Math.max(0, Math.floor((now - new Date(batch.started_at).getTime()) / 60000))
  const pct      = Math.min(100, (elapsed / COOLING_TARGET_MINUTES) * 100)
  const timeTone = elapsed > COOLING_TARGET_MINUTES ? 'bad' : elapsed > COOLING_TARGET_MINUTES - 15 ? 'explained' : 'ok'
  const barTone  = { ok: 'bg-good', explained: 'bg-warn', bad: 'bg-bad' }[timeTone]

  const hasTemp = endTemp !== '' && !Number.isNaN(parseFloat(endTemp))
  const tooWarm = hasTemp && parseFloat(endTemp) > (batch.target_temp ?? COOLING_TARGET_TEMP)
  const tooSlow = elapsed > COOLING_TARGET_MINUTES
  const needsNote = hasTemp && (tooWarm || tooSlow)
  const canFinish = hasTemp && (!needsNote || note.trim().length > 0)

  const finish = async () => {
    if (!canFinish || saving) return
    setSaving(true)
    const notes = [batch.notes, needsNote ? note.trim() : null].filter(Boolean).join('\n') || null
    // Guard on end_temp IS NULL so two devices can't both finish the same batch
    const { data, error } = await supabase
      .from('cooling_logs')
      .update({ end_temp: parseFloat(endTemp), finished_at: new Date().toISOString(), notes })
      .eq('id', batch.id)
      .is('end_temp', null)
      .select('id')
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    if (!data?.length) { toast(`${batch.food_item} was already finished on another device`, 'error'); onChanged(); return }
    toast(`${batch.food_item} · ${needsNote ? 'failed — corrective action recorded' : `cooled in ${formatCoolingMinutes(elapsed)}`}`)
    onChanged()
  }

  return (
    <div className={`${CARD} px-4 sm:px-5 py-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ink dark:text-white truncate">{batch.food_item}</p>
          <p className="text-sm text-ink3 dark:text-white/45 mt-0.5">
            <span className="font-mono text-ink2 dark:text-white/65">{Number(batch.start_temp).toFixed(0)}°C</span>
            {' · '}{coolingMethodLabel(batch.cooling_method)} · from {startedLabel(batch.started_at)}
          </p>
        </div>
        <span className={`shrink-0 h-8 px-3 rounded-full inline-flex items-center font-mono text-[14px] font-semibold ${TONE[timeTone]}`}>
          {elapsed}m / {COOLING_TARGET_MINUTES}m
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-line2 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${barTone} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
      </div>

      <ReadingInput
        value={endTemp}
        onChange={setEndTemp}
        onSubmit={finish}
        canSubmit={canFinish}
        saving={saving}
        warn={needsNote}
        placeholder="End temp"
        ariaLabel={`${batch.food_item} end temperature in °C`}
        submitLabel="Finish"
      />

      {needsNote && (
        <div className="rounded-xl border border-bad/25 bg-badBg/60 dark:bg-bad/15 p-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-bad dark:text-[#f19a86]">
            {tooSlow
              ? `Took longer than ${COOLING_TARGET_MINUTES} minutes. What did you do?`
              : `Still above ${batch.target_temp ?? COOLING_TARGET_TEMP}°C. Keep cooling, or record what you did.`}
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Moved to blast chiller, 4.8°C by 16:25"
            className="w-full px-3 py-2 rounded-lg border border-bad/25 bg-white dark:bg-paperDark text-sm text-ink dark:text-white placeholder:text-ink4 focus:outline-none focus:ring-2 focus:ring-bad/20 resize-none"
          />
        </div>
      )}

      {batch.notes && (
        <p className="text-sm text-ink3 dark:text-white/45"><span className="font-semibold text-ink2 dark:text-white/65">Note</span> · {batch.notes}</p>
      )}

      {canDiscard && (
        <button
          type="button"
          onClick={onDiscard}
          className="self-start text-xs font-medium text-ink3 dark:text-white/45 hover:text-bad transition-colors"
        >
          Started by mistake? Discard
        </button>
      )}
    </div>
  )
}

/* ── Start a batch ────────────────────────────────────────────────────────── */
function StartBatchForm({ session, venueId, onStarted }) {
  const toast = useToast()
  const frequent = useFrequentCoolingItems(4)
  const [foodItem, setFoodItem]   = useState('')
  const [startTemp, setStartTemp] = useState('')
  const clock = useTimeOfDay()
  const [method, setMethod]       = useState('blast_chiller')
  const [showNote, setShowNote]   = useState(false)
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)

  const hasTemp  = startTemp !== '' && !Number.isNaN(parseFloat(startTemp))
  const canStart = foodItem.trim() && hasTemp && clock.time

  const start = async () => {
    if (!canStart || saving) return
    setSaving(true)
    const { error } = await supabase.from('cooling_logs').insert({
      venue_id:       venueId,
      food_item:      foodItem.trim(),
      start_temp:     parseFloat(startTemp),
      end_temp:       null,
      target_temp:    COOLING_TARGET_TEMP,
      cooling_method: method,
      started_at:     clock.at.toISOString(),
      logged_by:      session?.staffId ?? null,
      logged_by_name: session?.staffName ?? 'Unknown',
      notes:          note.trim() || null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${foodItem.trim()} · cooling timer started`)
    setFoodItem('')
    setStartTemp('')
    setNote('')
    setShowNote(false)
    clock.reset()
    onStarted()
  }

  return (
    <div className={`${CARD} px-4 sm:px-5 py-5 flex flex-col gap-4`}>
      <p className="text-[19px] font-semibold text-ink dark:text-white">Start cooling a batch</p>

      <div className="flex flex-col gap-2.5">
        <input
          type="text"
          value={foodItem}
          onChange={e => setFoodItem(e.target.value)}
          placeholder="Food item, e.g. Chicken stock"
          aria-label="Food item"
          className={TEXT_FIELD}
        />
        <QuickPicks options={frequent} value={foodItem} onPick={setFoodItem} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TempField label="Start temp" value={startTemp} onChange={setStartTemp} placeholder="75" />
        <TimeOfDayField label="Started" clock={clock} />
      </div>

      <div>
        <span className={FIELD_LABEL}>Method</span>
        <div className="grid grid-cols-2 gap-2.5">
          {NEW_METHODS.map(m => (
            <button
              key={m.value}
              type="button"
              aria-pressed={method === m.value}
              onClick={() => setMethod(m.value)}
              className={[
                'h-12 rounded-xl border text-[15px] font-semibold transition-colors',
                method === m.value
                  ? 'bg-brand border-brand text-white'
                  : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
              ].join(' ')}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showNote && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Anything worth noting, e.g. split into shallow trays"
          className="w-full px-4 py-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white placeholder:text-ink4 focus:outline-none focus:ring-2 focus:ring-brand/15 resize-none"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowNote(v => !v)}
          className="shrink-0 px-3 h-12 text-[15px] font-semibold text-ink2 dark:text-white/75 hover:text-ink dark:hover:text-white"
        >
          {showNote ? 'No note' : '+ Note'}
        </button>
        <button
          type="button"
          onClick={start}
          disabled={!canStart || saving}
          className="flex-1 h-12 rounded-xl bg-brand text-white text-[16px] font-semibold inline-flex items-center justify-center gap-2 transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed"
        >
          <StopwatchIcon />
          {saving ? 'Starting…' : 'Start cooling timer'}
        </button>
      </div>
    </div>
  )
}

/* ── A finished batch ─────────────────────────────────────────────────────── */
function FinishedBatchRow({ log, compact = false }) {
  const { fail, reason, minutes } = coolingOutcome(log)
  const verdict = fail ? (reason === 'too_slow' ? 'Too slow' : 'Too warm') : 'Pass'
  const timeRange = log.finished_at
    ? `${format(new Date(log.started_at), 'HH:mm')}–${format(new Date(log.finished_at), 'HH:mm')}`
    : format(new Date(log.started_at), 'HH:mm')

  return (
    <div className="px-4 sm:px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ink dark:text-white truncate">{log.food_item}</p>
          <p className="text-sm text-ink3 dark:text-white/45 mt-0.5 truncate">
            {coolingMethodLabel(log.cooling_method)}{compact ? '' : ` · ${timeRange}`}
          </p>
        </div>
        {compact ? (
          <div className="shrink-0 flex items-center gap-2.5">
            <span className="font-mono text-sm sm:text-[15px] text-ink2 dark:text-white/70 whitespace-nowrap">
              {temp(log.start_temp)} → {temp(log.end_temp)}
            </span>
            <span className={`h-8 px-2.5 rounded-lg inline-flex items-center font-mono text-sm font-semibold whitespace-nowrap ${fail ? TONE.bad : TONE.ok}`}>
              {minutes === null ? verdict : formatCoolingMinutes(minutes)}
            </span>
          </div>
        ) : (
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <span className="font-mono text-[16px] font-semibold text-ink2 dark:text-white/70 whitespace-nowrap">
              {temp(log.start_temp)} → <span className={fail ? 'text-bad dark:text-[#f19a86]' : 'text-good dark:text-[#7fd1a4]'}>{temp(log.end_temp)}</span>
            </span>
            <span className={`h-7 px-3 rounded-full inline-flex items-center text-[13px] font-semibold whitespace-nowrap ${fail ? TONE.bad : TONE.ok}`}>
              {verdict}{minutes !== null && ` · ${formatCoolingMinutes(minutes)}`}
            </span>
          </div>
        )}
      </div>
      {fail && log.notes && (
        <p className="mt-2.5 px-3 py-2.5 rounded-lg bg-badBg dark:bg-bad/20 text-sm text-ink2 dark:text-white/75">
          {compact && <><span className="font-semibold text-bad dark:text-[#f19a86]">Corrective action</span> · </>}
          {log.notes}
        </p>
      )}
    </div>
  )
}

/* ── History tab ──────────────────────────────────────────────────────────── */
function CoolingHistory() {
  const [range, setRange] = useState(7)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const { logs, loading } = useCoolingLogs(historyDateFrom(range), todayStr)

  const outcomes = logs.map(log => coolingOutcome(log))
  const passed   = outcomes.filter(o => !o.fail).length
  const timed    = outcomes.filter(o => o.minutes !== null)
  const avg      = timed.length ? Math.round(timed.reduce((sum, o) => sum + o.minutes, 0) / timed.length) : null
  const failures = logs.length - passed

  // Grouped by the day the batch went in to cool, newest first
  const days = useMemo(() => groupByDay(logs, log => log.started_at), [logs])

  return (
    <div className="flex flex-col gap-4">
      <HistoryRangePills range={range} onRange={setRange} />

      {loading ? (
        <div className="py-12 text-center">
          <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 dark:border-white/15 border-t-charcoal animate-spin mx-auto" />
        </div>
      ) : (
        <>
          <StatStrip stats={[
            { value: logs.length ? formatPct((passed / logs.length) * 100) : '–', label: 'Passed', tone: 'good' },
            { value: formatCoolingMinutes(avg), label: 'Avg time', tone: null },
            { value: failures, label: failures === 1 ? 'Failure' : 'Failures', tone: failures ? 'bad' : null },
          ]} />

          {days.length === 0 ? (
            <p className="text-sm text-ink3 dark:text-white/40 py-10 text-center">No batches cooled in this period.</p>
          ) : days.map(([dateStr, dayLogs]) => (
            <DayCard key={dateStr} dateStr={dateStr} count={dayLogs.length} noun="batch" plural="batches">
              {dayLogs.map(log => <FinishedBatchRow key={log.id} log={log} compact />)}
            </DayCard>
          ))}
        </>
      )}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function CoolingLogsPage() {
  const toast = useToast()
  const { venueId, venueSlug } = useVenue()
  const { session, isManager } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = searchParams.get('tab') === 'history' ? 'history' : 'log'
  const setTab = (next) => setSearchParams(next === 'log' ? {} : { tab: next }, { replace: true })

  const { batches, loading: batchesLoading, reload: reloadBatches } = useCoolingInProgress()
  const todayStr     = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const { logs: recent, loading: recentLoading, reload: reloadRecent } = useCoolingLogs(yesterdayStr, todayStr)

  const [showExport, setShowExport]       = useState(false)
  const [discardTarget, setDiscardTarget] = useState(null)

  // Tick the cooling timers
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const reloadAll = () => { reloadBatches(); reloadRecent() }

  const discard = async (batch) => {
    const { error } = await supabase.from('cooling_logs').delete().eq('id', batch.id).is('end_temp', null)
    if (error) { toast(error.message, 'error'); return }
    toast(`${batch.food_item} discarded`)
    reloadBatches()
  }

  if (batchesLoading || recentLoading) {
    return <PageSkeleton />
  }

  // Finished today (legacy rows without a finish time count by start time)
  const completedToday = recent.filter(log => isToday(new Date(log.finished_at ?? log.started_at)))
  const passedToday    = completedToday.filter(log => !coolingOutcome(log).fail).length

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader
        title="Cooling logs"
        backTo={isManager ? `/v/${venueSlug}/checks` : null}
        onExport={() => setShowExport(true)}
      />

      <TabBar
        tabs={[
          { id: 'log', label: 'Log', count: batches.length },
          { id: 'history', label: 'History' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <CoolingExportModal open={showExport} onClose={() => setShowExport(false)} />
      <ConfirmDialog
        open={!!discardTarget}
        title="Discard this batch?"
        message={discardTarget ? `Remove "${discardTarget.food_item}" from the cooling list? Only do this if it was started by mistake — a batch that went wrong should be finished with a corrective action instead.` : ''}
        confirmLabel="Discard"
        danger
        onClose={() => setDiscardTarget(null)}
        onConfirm={() => { discard(discardTarget); setDiscardTarget(null) }}
      />

      {tab === 'log' && (
        <>
          {batches.length > 0 && (
            <>
              <SectionHeading aside={`Target ≤${COOLING_TARGET_TEMP}°C within ${COOLING_TARGET_MINUTES} min`}>Cooling now</SectionHeading>
              {batches.map(batch => (
                <CoolingBatchCard
                  key={batch.id}
                  batch={batch}
                  now={now}
                  canDiscard={isManager || batch.logged_by === session?.staffId}
                  onChanged={reloadAll}
                  onDiscard={() => setDiscardTarget(batch)}
                />
              ))}
            </>
          )}

          <StartBatchForm session={session} venueId={venueId} onStarted={reloadBatches} />

          {completedToday.length > 0 && (
            <>
              <SectionHeading aside={<span className="font-mono">{passedToday}/{completedToday.length} passed</span>}>Completed today</SectionHeading>
              <div className={`${CARD} divide-y divide-line dark:divide-white/10`}>
                {completedToday.map(log => <FinishedBatchRow key={log.id} log={log} />)}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'history' && <CoolingHistory />}
    </div>
  )
}
