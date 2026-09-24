import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useFridges, useTodayCheckStatus } from '../../hooks/useFridgeLogs'
import { useSession } from '../../contexts/SessionContext'
import { isTempOutOfRange, formatTemp } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import FridgeExportModal from './FridgeExportModal'
import FridgeHistoryTab from './FridgeHistoryTab'
import TemperatureItemSettingsModal from '../../components/temperature/TemperatureItemSettingsModal'
import {
  CARD, FRIDGE_ICON, PageHeader, TabBar, AddDashedButton, PeriodChip, ItemHeading, ReadingInput, ItemSettingsRow,
} from '../../components/temperature/TempPageParts'
import { formatCheckDaysCompact, formatRequiredPeriods, isCheckRequired } from '../../lib/temperatureChecks'

// Reasons that are "explained" — reading is recorded honestly but no compliance penalty
const EXCEEDANCE_REASONS = [
  { id: 'delivery',       label: 'Delivery / restocking',  explained: true  },
  { id: 'defrost',        label: 'Defrost cycle',           explained: true  },
  { id: 'service_access', label: 'Busy service access',     explained: true  },
  { id: 'equipment',      label: 'Equipment concern',       explained: false },
  { id: 'other',          label: 'Other reason',            explained: false },
]
const EXPLAINED_IDS = EXCEEDANCE_REASONS.filter(r => r.explained).map(r => r.id)

const EXCEEDANCE_ICONS = {
  delivery:       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  defrost:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  service_access: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  equipment:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>,
  other:          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
}

const NEW_FRIDGE = { name: '', min_temp: '', max_temp: '' }

function rangeLabel(fridge) {
  return `${fridge.min_temp}–${fridge.max_temp}°C`
}

// "AM 6.0°" chip for a logged reading, or "AM missed"; nothing otherwise
function ReadingChip({ period, log, fridge, missed }) {
  if (!log) return missed ? <PeriodChip period={period} value="missed" tone="missed" /> : null
  let tone = 'ok'
  if (isTempOutOfRange(log.temperature, fridge.min_temp, fridge.max_temp)) {
    tone = EXPLAINED_IDS.includes(log.exceedance_reason) ? 'explained' : 'bad'
  }
  return <PeriodChip period={period} value={`${Number(log.temperature).toFixed(1)}°`} tone={tone} />
}

/* ── One fridge in the Log tab ───────────────────────────────────────────── */
function FridgeLogRow({ fridge, status, session, venueId, canLog, onSaved }) {
  const toast = useToast()
  const [temp, setTemp]         = useState('')
  const [reason, setReason]     = useState(null)
  const [comment, setComment]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [logAgain, setLogAgain] = useState(false)
  const commentRef              = useRef(null)

  // Follow-up reminder — persisted to localStorage so it survives page reloads
  const FOLLOWUP_KEY = `pelikn_followup_${fridge.id}`
  const [followUp, setFollowUp] = useState(() => {
    try {
      const stored = localStorage.getItem(FOLLOWUP_KEY)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      // Discard if more than 2 hours old
      if (new Date(parsed.dueAt) < new Date(Date.now() - 2 * 60 * 60 * 1000)) {
        localStorage.removeItem(FOLLOWUP_KEY)
        return null
      }
      return parsed
    } catch { return null }
  })

  const currentPeriod  = new Date().getHours() < 12 ? 'am' : 'pm'
  const requiredNow    = isCheckRequired(fridge, new Date(), currentPeriod)
  const currentLog     = status?.[currentPeriod] ?? null
  const showInput      = canLog && (!currentLog || logAgain)
  const outOfRange     = temp !== '' && isTempOutOfRange(temp, fridge.min_temp, fridge.max_temp)
  const selectedReason = EXCEEDANCE_REASONS.find(r => r.id === reason)
  const isExplained    = selectedReason?.explained ?? false
  const needsNote      = reason !== null && !isExplained
  const canSave        = temp !== '' && (
    !outOfRange ||
    (reason !== null && (isExplained || comment.trim().length >= 5))
  )
  // AM counts as missed once the PM window opens without a reading
  const amMissed = currentPeriod === 'pm' && !status?.am && status?.amRequired

  // Reset reason/comment when temp changes to in-range
  useEffect(() => {
    if (!outOfRange) { setReason(null); setComment('') }
  }, [outOfRange])

  const save = useCallback(async () => {
    if (!canSave || saving) return
    setSaving(true)
    const now = new Date()
    const followUpDueAt = isExplained ? new Date(now.getTime() + 30 * 60 * 1000) : null

    const { error } = await supabase.from('fridge_temperature_logs').insert({
      fridge_id:         fridge.id,
      fridge_name:       fridge.name,
      temperature:       parseFloat(temp),
      logged_by:         session?.staffId,
      logged_by_name:    session?.staffName ?? 'Unknown',
      notes:             comment.trim() || null,
      logged_at:         now.toISOString(),
      check_period:      now.getHours() < 12 ? 'am' : 'pm',
      venue_id:          venueId,
      exceedance_reason: reason ?? null,
      follow_up_due_at:  followUpDueAt?.toISOString() ?? null,
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }

    const parsedTemp = parseFloat(temp)

    if (isExplained && followUpDueAt) {
      const fu = { dueAt: followUpDueAt.toISOString(), temp: parsedTemp }
      localStorage.setItem(FOLLOWUP_KEY, JSON.stringify(fu))
      setFollowUp(fu)
    } else if (!outOfRange) {
      // In-range reading clears any pending follow-up
      localStorage.removeItem(FOLLOWUP_KEY)
      setFollowUp(null)
    }

    toast(
      outOfRange && !isExplained
        ? `${fridge.name}: ${formatTemp(parsedTemp)} logged — action required`
        : `${fridge.name}: ${formatTemp(parsedTemp)} logged`,
      outOfRange && !isExplained ? 'error' : undefined,
    )
    setTemp('')
    setReason(null)
    setComment('')
    setLogAgain(false)
    onSaved()
  }, [canSave, saving, temp, comment, reason, fridge, session, venueId,
      outOfRange, isExplained, onSaved, toast, FOLLOWUP_KEY])

  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
  }
  const dismissFollowUp = () => { localStorage.removeItem(FOLLOWUP_KEY); setFollowUp(null) }

  return (
    <div className="px-4 sm:px-5 py-4 flex flex-col gap-3">
      <ItemHeading
        name={fridge.name}
        range={rangeLabel(fridge)}
        schedule={formatCheckDaysCompact(fridge.check_days)}
        note={!requiredNow && !currentLog ? `Not due this ${currentPeriod.toUpperCase()}` : null}
        chips={<>
          <ReadingChip period="am" log={status?.am} fridge={fridge} missed={amMissed} />
          <ReadingChip period="pm" log={status?.pm} fridge={fridge} />
        </>}
      />

      {/* Follow-up reminder */}
      {followUp && (
        <div className="rounded-xl border border-warning/35 bg-warning/8 px-3 py-2.5 flex items-start gap-2">
          <span className="shrink-0 mt-0.5 text-warning">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-charcoal dark:text-white">
              Follow-up check due {format(new Date(followUp.dueAt), 'HH:mm')}
            </p>
            <p className="text-[11px] text-charcoal/50 dark:text-white/40 mt-0.5">
              Last reading was {formatTemp(followUp.temp)} — log a new reading to confirm the temperature has recovered.
            </p>
          </div>
          <button onClick={dismissFollowUp} aria-label="Dismiss" className="text-charcoal/25 dark:text-white/25 hover:text-charcoal dark:hover:text-white shrink-0 text-sm leading-none mt-0.5">×</button>
        </div>
      )}

      {!canLog ? null : !showInput ? (
        <button
          type="button"
          onClick={() => setLogAgain(true)}
          className="self-start text-xs font-medium text-ink3 dark:text-white/45 hover:text-ink dark:hover:text-white transition-colors"
        >
          + Log another reading
        </button>
      ) : (
        <>
          <ReadingInput
            value={temp}
            onChange={setTemp}
            onSubmit={save}
            canSubmit={canSave}
            saving={saving}
            warn={outOfRange}
            placeholder={`${currentPeriod.toUpperCase()} reading`}
            ariaLabel={`${fridge.name} ${currentPeriod.toUpperCase()} reading in °C`}
          />

          {/* Out-of-range: reason picker */}
          {outOfRange && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-warning">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </span>
                <p className="text-xs font-semibold text-charcoal dark:text-white">Outside safe range — what's the reason?</p>
              </div>

              <div className="flex flex-col gap-1.5">
                {EXCEEDANCE_REASONS.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setReason(r.id); setComment(''); setTimeout(() => commentRef.current?.focus(), 50) }}
                    className={[
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all',
                      reason === r.id
                        ? r.explained
                          ? 'bg-warning/15 border-warning/40 text-charcoal dark:text-white'
                          : 'bg-danger/8 border-danger/25 text-charcoal dark:text-white'
                        : 'bg-white dark:bg-paperDark border-charcoal/12 dark:border-white/15 text-charcoal/60 dark:text-white/50 hover:border-charcoal/25 dark:hover:border-white/25 hover:text-charcoal dark:hover:text-white',
                    ].join(' ')}
                  >
                    <span className="shrink-0 text-charcoal/50 dark:text-white/40">{EXCEEDANCE_ICONS[r.id]}</span>
                    <span className="flex-1">{r.label}</span>
                    {r.explained && (
                      <span className="text-[11px] tracking-wide text-success font-semibold">No penalty</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Explained: green confirmation */}
              {reason && isExplained && (
                <div className="rounded-lg bg-success/8 border border-success/20 px-3 py-2.5 flex items-start gap-2">
                  <span className="text-success shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                  </span>
                  <div>
                    <p className="text-xs font-medium text-charcoal dark:text-white">Explained exceedance — no compliance penalty</p>
                    <p className="text-[11px] text-charcoal/50 dark:text-white/40 mt-0.5">
                      The reading is recorded honestly in your audit log. A 30‑minute follow‑up reminder will appear to confirm the temperature recovers.
                    </p>
                  </div>
                </div>
              )}

              {/* Equipment / other: corrective action textarea */}
              {reason && needsNote && (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    ref={commentRef}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="Describe the corrective action taken…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark focus:outline-none focus:ring-2 focus:ring-danger/20 text-sm resize-none"
                  />
                  <p className="text-[11px] text-charcoal/35 dark:text-white/30">
                    {comment.trim().length < 5 ? `${5 - comment.trim().length} more characters needed` : 'Tap Log to save'}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const FRIDGE_RANGE_HINT = {
  min: '0',
  max: '5',
  note: 'Suggested chilled range: 0-5°C. For freezers, set the safe max to -18°C or colder.',
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function FridgeDashboardPage() {
  const toast = useToast()
  const { venueId, venueSlug } = useVenue()
  const { fridges, loading: fridgesLoading, reload: reloadFridges } = useFridges()
  const { status: checkStatus, loading: dashLoading, reload: reloadDash } = useTodayCheckStatus()
  const { session, isManager, hasPermission } = useSession()
  const canLog = hasPermission('log_temps')
  const [searchParams, setSearchParams] = useSearchParams()

  const [showExport, setShowExport]   = useState(false)
  const [showAdd, setShowAdd]         = useState(false)
  const [openFridgeId, setOpenFridgeId] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)

  const tabs = isManager ? ['log', 'fridges', 'history'] : ['log', 'history']
  const tab  = tabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'log'
  const setTab = (next) => setSearchParams(next === 'log' ? {} : { tab: next }, { replace: true })

  const reloadAll = () => { reloadFridges(); reloadDash() }

  const addFridge = async (values) => {
    const { error } = await supabase.from('fridges').insert({ ...values, venue_id: venueId })
    if (error) { toast(error.message, 'error'); return }
    toast(`${values.name} added`)
    setShowAdd(false)
    reloadAll()
  }

  const removeFridge = async (id, name) => {
    const { error } = await supabase.from('fridges').update({ is_active: false }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} removed`)
    setOpenFridgeId(null)
    reloadAll()
  }

  const saveFridgeSettings = async (fridge, values) => {
    const { error } = await supabase
      .from('fridges')
      .update(values)
      .eq('venue_id', venueId)
      .eq('id', fridge.id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${values.name} settings saved`)
    setOpenFridgeId(null)
    reloadAll()
  }

  if (fridgesLoading || dashLoading) {
    return <PageSkeleton />
  }

  const now           = new Date()
  const currentPeriod = now.getHours() < 12 ? 'am' : 'pm'
  const statusById    = Object.fromEntries(checkStatus.map(s => [s.id, s]))
  const totalToday    = checkStatus.filter(f => f.amRequired).length + checkStatus.filter(f => f.pmRequired).length
  const doneToday     = checkStatus.filter(f => f.amRequired && f.am).length + checkStatus.filter(f => f.pmRequired && f.pm).length
  const dueNow        = checkStatus.filter(f => f[`${currentPeriod}Required`] && !f[currentPeriod]).length

  const tabMeta = {
    log:     { label: 'Log',     count: dueNow || null },
    fridges: { label: 'Fridges', count: fridges.length || null },
    history: { label: 'History', count: null },
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader
        title="Fridge Temperatures"
        backTo={isManager ? `/v/${venueSlug}/checks` : null}
        onExport={() => setShowExport(true)}
      />

      <TabBar
        tabs={tabs.map(id => ({ id, ...tabMeta[id] }))}
        active={tab}
        onChange={setTab}
      />

      <FridgeExportModal open={showExport} onClose={() => setShowExport(false)} />
      <TemperatureItemSettingsModal
        open={showAdd}
        item={NEW_FRIDGE}
        title="Add fridge or freezer"
        saveLabel="Add"
        suggestedRange={FRIDGE_RANGE_HINT}
        onClose={() => setShowAdd(false)}
        onSave={addFridge}
      />
      <ConfirmDialog
        open={!!removeTarget}
        title="Remove fridge?"
        message={removeTarget ? `Remove "${removeTarget.name}"? Its logging history is kept, but it'll no longer show up for checks.` : ''}
        confirmLabel="Remove"
        danger
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { removeFridge(removeTarget.id, removeTarget.name); setRemoveTarget(null) }}
      />

      {/* ── Log tab ── */}
      {tab === 'log' && (
        fridges.length === 0 ? (
          <div className={`${CARD} p-8 text-center flex flex-col items-center gap-4`}>
            <p className="text-sm text-ink3 dark:text-white/45">No fridges set up yet.</p>
            {isManager && <AddDashedButton label="Add fridge or freezer" onClick={() => setShowAdd(true)} />}
          </div>
        ) : (
          <>
            {totalToday > 0 && (
              <div className={`${CARD} px-4 sm:px-5 py-3.5`}>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 px-2 py-1 rounded-md bg-brand text-white font-mono text-xs font-bold">{currentPeriod.toUpperCase()}</span>
                  <p className="flex-1 min-w-0 text-[15px] font-semibold text-ink dark:text-white truncate">
                    Today's checks · {format(now, 'EEE d MMM')}
                  </p>
                  <span className="shrink-0 font-mono text-[15px] font-semibold text-ink2 dark:text-white/70">{doneToday}/{totalToday}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-line2 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-good transition-[width] duration-500"
                    style={{ width: `${Math.round((doneToday / totalToday) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className={`${CARD} divide-y divide-line dark:divide-white/10`}>
              {fridges.map(fridge => (
                <FridgeLogRow
                  key={fridge.id}
                  fridge={fridge}
                  status={statusById[fridge.id]}
                  session={session}
                  venueId={venueId}
                  canLog={canLog}
                  onSaved={reloadDash}
                />
              ))}
            </div>

            {isManager && <AddDashedButton label="Add fridge or freezer" onClick={() => setShowAdd(true)} />}
          </>
        )
      )}

      {/* ── Fridges tab (managers) ── */}
      {tab === 'fridges' && isManager && (
        <>
          {fridges.length > 0 && (
            <>
              <p className="text-sm text-ink3 dark:text-white/45 px-1">Tap a unit to edit its safe range and check schedule.</p>
              <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
                {fridges.map(fridge => (
                  <ItemSettingsRow
                    key={fridge.id}
                    icon={FRIDGE_ICON}
                    name={fridge.name}
                    subline={<>
                      <span className="font-mono text-ink2 dark:text-white/65">{rangeLabel(fridge)}</span>
                      {' · '}{formatCheckDaysCompact(fridge.check_days)} · {formatRequiredPeriods(fridge.required_periods)}
                    </>}
                    open={openFridgeId === fridge.id}
                    onToggle={() => setOpenFridgeId(id => (id === fridge.id ? null : fridge.id))}
                    onRemove={() => setRemoveTarget(fridge)}
                    formProps={{
                      item: fridge,
                      suggestedRange: FRIDGE_RANGE_HINT,
                      onSave: (values) => saveFridgeSettings(fridge, values),
                    }}
                  />
                ))}
              </div>
            </>
          )}
          <AddDashedButton label="Add fridge or freezer" onClick={() => setShowAdd(true)} />
        </>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && <FridgeHistoryTab canLog={canLog} />}
    </div>
  )
}
