/**
 * CookingTempsPage — log cooking and reheating core temperatures.
 *
 * UK Food Safety (Temperature Control) Regulations 1995: cooking and reheating
 * must reach a core temperature of 75°C or above. A reading below that needs a
 * corrective action before it can be logged.
 *
 * Tabs:
 *   - Log reading: the form, then today's readings
 *   - History: pass rate, average core temp and failures, one card per day
 */
import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import {
  useCookingLogs, useTodayCookingLogs, useFrequentCookingItems, isCookingTempFail, COOKING_TARGET_TEMP,
} from '../../hooks/useCookingLogs'
import {
  CARD, TONE, PageHeader, TabBar, SectionHeading, QuickPicks, TempField, TimeOfDayField, useTimeOfDay,
  FIELD_LABEL, TEXT_FIELD,
} from '../../components/temperature/TempPageParts'
import { HistoryRangePills, StatStrip, DayCard, formatPct, historyDateFrom, groupByDay } from '../../components/temperature/TempHistoryView'

const CHECK_TYPES = [
  { value: 'cooking',   label: 'Cooking' },
  { value: 'reheating', label: 'Reheating' },
]
const CHECK_LABEL = Object.fromEntries(CHECK_TYPES.map(t => [t.value, t.label]))

const TEXT_AREA = 'w-full px-4 py-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 resize-none transition-colors'

const failed = (log) => isCookingTempFail(log.temperature, log.target_temp ?? COOKING_TARGET_TEMP)

// "Priya Shah" → "Priya S."
function shortName(name) {
  if (!name) return null
  const [first, ...rest] = name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

/* ── One logged reading ───────────────────────────────────────────────────── */
function ReadingRow({ log, withStaff = false, compact = false }) {
  const fail = failed(log)
  const temp = Number(log.temperature).toFixed(1)
  const meta = [CHECK_LABEL[log.check_type] ?? log.check_type, format(new Date(log.logged_at), 'HH:mm'), withStaff && shortName(log.logged_by_name)]
    .filter(Boolean).join(' · ')
  return (
    <div className="px-4 sm:px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ink dark:text-white truncate">{log.food_item}</p>
          <p className="text-sm text-ink3 dark:text-white/45 mt-0.5 truncate">{meta}</p>
        </div>
        <span className={`shrink-0 h-9 px-3.5 rounded-lg inline-flex items-center font-mono text-[16px] font-semibold ${fail ? TONE.bad : TONE.ok}`}>
          {compact ? `${temp}°` : `${temp}°C`}
        </span>
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

/* ── Log a reading ────────────────────────────────────────────────────────── */
function LogReadingForm({ onLogged }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()
  const frequent = useFrequentCookingItems(4)
  const clock = useTimeOfDay()

  const [checkType, setCheckType] = useState('cooking')
  const [foodItem, setFoodItem]   = useState('')
  const [temp, setTemp]           = useState('')
  const [showNote, setShowNote]   = useState(false)
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)

  const tempNum = parseFloat(temp)
  const hasTemp = temp !== '' && !Number.isNaN(tempNum)
  const isFail  = hasTemp && isCookingTempFail(tempNum, COOKING_TARGET_TEMP)
  // A fail can't be logged without saying what was done about it
  const canLog  = foodItem.trim().length >= 2 && hasTemp && (!isFail || note.trim().length >= 5) && !saving

  const save = async () => {
    if (!canLog) return
    setSaving(true)
    const { error } = await supabase.from('cooking_temp_logs').insert({
      venue_id:       venueId,
      check_type:     checkType,
      food_item:      foodItem.trim(),
      temperature:    tempNum,
      target_temp:    COOKING_TARGET_TEMP,
      logged_by:      session?.staffId ?? null,
      logged_by_name: session?.staffName ?? 'Unknown',
      logged_at:      clock.at.toISOString(),
      notes:          note.trim() || null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${foodItem.trim()} · ${tempNum.toFixed(1)}°C logged`)
    setFoodItem('')
    setTemp('')
    setNote('')
    setShowNote(false)
    clock.reset()
    onLogged()
  }

  return (
    <div className={`${CARD} px-4 sm:px-6 py-5 flex flex-col gap-5`}>
      <div className="grid grid-cols-2 gap-3">
        {CHECK_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            aria-pressed={checkType === t.value}
            onClick={() => setCheckType(t.value)}
            className={[
              'h-14 rounded-2xl border-2 text-[17px] font-semibold transition-colors',
              checkType === t.value
                ? 'border-brand bg-brand-tint text-ink dark:bg-white/10 dark:border-white/70 dark:text-white'
                : 'border-line dark:border-white/10 bg-white dark:bg-paperDark text-ink2 dark:text-white/75 hover:border-ink4/60',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <label>
          <span className={FIELD_LABEL}>Food item</span>
          <input
            type="text"
            value={foodItem}
            onChange={e => setFoodItem(e.target.value)}
            placeholder="e.g. Chicken breast"
            className={TEXT_FIELD}
          />
        </label>
        <QuickPicks options={frequent} value={foodItem} onPick={setFoodItem} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TempField label="Core temp" value={temp} onChange={setTemp} placeholder="75.0" warn={isFail} />
        <TimeOfDayField label="Time" clock={clock} />
      </div>

      {isFail && (
        <div className="rounded-xl border border-bad/25 bg-badBg/60 dark:bg-bad/15 p-3 flex flex-col gap-2 -mt-1">
          <p className="text-sm font-semibold text-bad dark:text-[#f19a86]">
            Below {COOKING_TARGET_TEMP}°C. Keep cooking and re-probe, and say what you did.
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Back on grill 2 min, re-probed at 77.6°C"
            aria-label="Corrective action"
            className="w-full px-3 py-2 rounded-lg border border-bad/25 bg-white dark:bg-paperDark text-sm text-ink dark:text-white placeholder:text-ink4 focus:outline-none focus:ring-2 focus:ring-bad/20 resize-none"
          />
        </div>
      )}

      {showNote && !isFail && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Anything worth noting"
          aria-label="Note"
          className={TEXT_AREA}
        />
      )}

      <div className="flex items-center gap-3">
        {!isFail && (
          <button
            type="button"
            onClick={() => setShowNote(v => !v)}
            className="shrink-0 px-3 h-12 text-[15px] font-semibold text-ink2 dark:text-white/75 hover:text-ink dark:hover:text-white"
          >
            {showNote ? 'No note' : '+ Note'}
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!canLog}
          className="flex-1 h-[52px] rounded-2xl bg-brand text-white text-[17px] font-semibold transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Log temperature'}
        </button>
      </div>
    </div>
  )
}

/* ── History tab ──────────────────────────────────────────────────────────── */
function CookingHistory() {
  const [range, setRange] = useState(7)
  const { logs, loading } = useCookingLogs(null, historyDateFrom(range), format(new Date(), 'yyyy-MM-dd'))

  const passed   = logs.filter(log => !failed(log)).length
  const failures = logs.length - passed
  const avg      = logs.length ? logs.reduce((sum, log) => sum + Number(log.temperature), 0) / logs.length : null
  const days     = useMemo(() => groupByDay(logs, log => log.logged_at), [logs])

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
            { value: avg === null ? '–' : `${avg.toFixed(1)}°`, label: 'Avg core', tone: null },
            { value: failures, label: failures === 1 ? 'Failure' : 'Failures', tone: failures ? 'bad' : null },
          ]} />

          {days.length === 0 ? (
            <p className="text-sm text-ink3 dark:text-white/40 py-10 text-center">No readings in this period.</p>
          ) : days.map(([dateStr, dayLogs]) => (
            <DayCard key={dateStr} dateStr={dateStr} count={dayLogs.length} noun="reading">
              {dayLogs.map(log => <ReadingRow key={log.id} log={log} compact />)}
            </DayCard>
          ))}
        </>
      )}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function CookingTempsPage() {
  const { venueSlug } = useVenue()
  const { isManager } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const { logs: todayLogs, loading, reload } = useTodayCookingLogs()

  const tab = searchParams.get('tab') === 'history' ? 'history' : 'log'
  const setTab = (next) => setSearchParams(next === 'log' ? {} : { tab: next }, { replace: true })

  if (loading) return <PageSkeleton />

  const passedToday = todayLogs.filter(log => !failed(log)).length

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader
        title="Cooking temps"
        backTo={isManager ? `/v/${venueSlug}/checks` : null}
        action={<span className="shrink-0 self-end pb-1 font-mono text-sm text-ink3 dark:text-white/45 whitespace-nowrap">UK min ≥{COOKING_TARGET_TEMP}°C</span>}
      />

      <TabBar
        tabs={[
          { id: 'log', label: 'Log reading', count: todayLogs.length },
          { id: 'history', label: 'History' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'log' && (
        <>
          <LogReadingForm onLogged={reload} />

          {todayLogs.length > 0 && (
            <>
              <SectionHeading aside={<span className="font-mono">{passedToday}/{todayLogs.length} passed</span>}>Today's readings</SectionHeading>
              <div className={`${CARD} divide-y divide-line dark:divide-white/10`}>
                {todayLogs.map(log => <ReadingRow key={log.id} log={log} withStaff />)}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'history' && <CookingHistory />}
    </div>
  )
}
