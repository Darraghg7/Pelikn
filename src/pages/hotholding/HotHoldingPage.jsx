/**
 * HotHoldingPage — twice-daily hot holding temperature checks.
 *
 * UK Food Safety Regulations: food held hot for service must be ≥63°C.
 * Venues check AM and PM on the days and periods set for each item.
 *
 * Tabs:
 *   - Today's check: AM / PM cards, then one row per item due in the chosen period
 *   - Items (managers): add items, tap one to edit its range and schedule
 *   - History: per-day AM/PM grid with stats and corrective actions
 */
import React, { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useAppSettings } from '../../hooks/useSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import {
  useHotHoldingItems,
  useHotHoldingTodayStatus,
  useHotHoldingMatrix,
  isHotHoldingFail,
  HOT_HOLDING_MIN_TEMP,
} from '../../hooks/useHotHolding'
import { formatCheckDaysCompact, formatRequiredPeriods, isCheckRequired } from '../../lib/temperatureChecks'
import {
  CARD, TONE, THERMOMETER_ICON, PageHeader, TabBar, AddDashedButton, PeriodChip, ItemHeading, ReadingInput, ItemSettingsRow,
} from '../../components/temperature/TempPageParts'
import TempHistoryView, { historyDateFrom, buildClosedDateSet } from '../../components/temperature/TempHistoryView'
import HotHoldingExportModal from './HotHoldingExportModal'

const PERIOD_NAMES = { am: 'Morning check', pm: 'Evening check' }

const RANGE_HINT = {
  min: '63',
  max: 'Optional',
  note: 'Suggested hot holding minimum is 63°C. Leave max blank unless your process has an upper limit.',
}

function rangeLabel(item) {
  const min = item?.min_temp ?? HOT_HOLDING_MIN_TEMP
  return item?.max_temp === null || item?.max_temp === undefined
    ? `≥${min}°C`
    : `${min}–${item.max_temp}°C`
}

function failLabel(temp, item) {
  return parseFloat(temp) < (item?.min_temp ?? HOT_HOLDING_MIN_TEMP) ? 'Too cold' : 'Too hot'
}

/* ── AM / PM summary card ─────────────────────────────────────────────────── */
function PeriodCard({ period, selected, done, total, currentPeriod, onSelect }) {
  let pill
  if (total === 0)                 pill = { label: 'Not scheduled', cls: 'bg-line2 text-ink3 dark:bg-white/10 dark:text-white/45' }
  else if (done === total)         pill = { label: 'Complete',      cls: TONE.ok }
  else if (period === currentPeriod) pill = { label: 'Due now',     cls: TONE.missed }
  else if (period === 'pm')        pill = { label: 'Later',         cls: 'bg-line2 text-ink3 dark:bg-white/10 dark:text-white/45' }
  else                             pill = { label: 'Missed',        cls: TONE.bad }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'text-left rounded-2xl bg-white dark:bg-paperDark px-3.5 min-[420px]:px-3.5 py-2 transition-colors',
        selected ? 'border-2 border-brand dark:border-white/70' : 'border-2 border-line dark:border-white/10 hover:border-ink4/60',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`px-2 py-1 rounded-md font-mono text-xs font-bold ${selected ? 'bg-brand text-white' : 'bg-line2 text-ink2 dark:bg-white/10 dark:text-white/70'}`}>
          {period.toUpperCase()}
        </span>
        <span className={`px-2.5 py-1 rounded-full text-xs sm:text-[12px] font-semibold whitespace-nowrap ${pill.cls}`}>{pill.label}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[13px] min-[420px]:text-[13px] font-semibold text-ink dark:text-white truncate">{PERIOD_NAMES[period]}</p>
        <span className="shrink-0 font-mono text-[13px] min-[420px]:text-[13px] font-semibold text-ink2 dark:text-white/70">{done}/{total}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-line2 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-good transition-[width] duration-500" style={{ width: total ? `${Math.round((done / total) * 100)}%` : '0%' }} />
      </div>
    </button>
  )
}

/* ── One item in Today's check ────────────────────────────────────────────── */
function HotHoldingRow({ item, period, log, otherLog, otherRequired, session, venueId, onSaved }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [temp, setTemp]       = useState('')
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)

  const other    = period === 'am' ? 'pm' : 'am'
  const hasTemp  = temp !== '' && !Number.isNaN(parseFloat(temp))
  const fail     = hasTemp && isHotHoldingFail(parseFloat(temp), item)
  const canSave  = hasTemp && (!fail || note.trim().length > 0)
  const showForm = !log || editing

  // A correction is a new reading, not an overwrite, so the audit trail keeps both
  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const value = parseFloat(temp)
    const { error } = await supabase.from('hot_holding_logs').insert({
      venue_id:       venueId,
      item_id:        item.id,
      item_name:      item.name,
      temperature:    value,
      check_period:   period,
      logged_by:      session?.staffId ?? null,
      logged_by_name: session?.staffName ?? 'Unknown',
      logged_at:      new Date().toISOString(),
      notes:          note.trim() || null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${item.name} · ${value.toFixed(1)}°C logged`)
    setTemp('')
    setNote('')
    setEditing(false)
    onSaved()
  }

  const otherChip = otherRequired
    ? otherLog
      ? <PeriodChip period={other} value={`${Number(otherLog.temperature).toFixed(1)}°`} tone={isHotHoldingFail(otherLog.temperature, item) ? 'bad' : 'ok'} />
      : <PeriodChip period={other} value={null} />
    : null

  const logFail = log && isHotHoldingFail(log.temperature, item)

  return (
    <div className="px-3.5 sm:px-3.5 py-2.5 flex flex-col gap-2.5">
      <ItemHeading
        name={item.name}
        range={rangeLabel(item)}
        schedule={formatCheckDaysCompact(item.check_days)}
        chips={otherChip}
      />

      {!showForm ? (
        <div className={`flex items-center gap-2.5 rounded-xl px-3.5 sm:px-3.5 py-2 ${logFail ? TONE.bad : TONE.ok}`}>
          <span className="font-mono text-[19px] leading-none font-semibold">{Number(log.temperature).toFixed(1)}°C</span>
          <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">
            {logFail ? failLabel(log.temperature, item) : 'Safe'} · {format(new Date(log.logged_at), 'HH:mm')}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 px-2 py-1 text-[13px] font-semibold text-ink2 dark:text-white/80 hover:text-ink dark:hover:text-white"
          >
            Edit
          </button>
        </div>
      ) : (
        <>
          <ReadingInput
            value={temp}
            onChange={setTemp}
            onSubmit={save}
            canSubmit={canSave}
            saving={saving}
            warn={fail}
            autoFocus={editing}
            placeholder={`${period.toUpperCase()} reading`}
            ariaLabel={`${item.name} ${period.toUpperCase()} reading in °C`}
          />
          {fail && (
            <div className="rounded-xl border border-bad/25 bg-badBg/60 dark:bg-bad/15 p-2.5 flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-bad dark:text-[#f19a86]">
                {failLabel(temp, item)} — outside the safe {rangeLabel(item)} range. What did you do?
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Reheated to 75°C and returned to hot hold"
                className="w-full px-3 py-2 rounded-lg border border-bad/25 bg-white dark:bg-paperDark text-[13px] text-ink dark:text-white placeholder:text-ink4 focus:outline-none focus:ring-2 focus:ring-bad/20 resize-none"
              />
            </div>
          )}
          {editing && (
            <button
              type="button"
              onClick={() => { setEditing(false); setTemp(''); setNote('') }}
              className="self-start text-xs font-medium text-ink3 dark:text-white/45 hover:text-ink dark:hover:text-white"
            >
              Cancel — keep {Number(log.temperature).toFixed(1)}°C
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ── History tab ──────────────────────────────────────────────────────────── */
function HotHoldingHistory() {
  const [range, setRange] = useState(7)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const dateFrom = historyDateFrom(range)

  const { items, matrix, loading } = useHotHoldingMatrix(dateFrom, todayStr)
  const { closedDays } = useAppSettings()
  const { closures }   = useVenueClosures()

  const closedSet = useMemo(
    () => buildClosedDateSet({ dateFrom, dateTo: todayStr, closedDays, closures }),
    [dateFrom, todayStr, closedDays, closures]
  )

  return (
    <TempHistoryView
      items={items}
      matrix={matrix}
      loading={loading}
      range={range}
      onRange={setRange}
      closedSet={closedSet}
      statusOf={(log, item) => (isHotHoldingFail(log.temperature, item) ? 'bad' : 'ok')}
      noteOf={(log) => log.notes}
      safeLabel="Safe"
      emptyText="No hot holding items yet."
    />
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function HotHoldingPage() {
  const toast = useToast()
  const { venueId, venueSlug } = useVenue()
  const { session, isManager } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()

  const { items, loading: itemsLoading, reload: reloadItems } = useHotHoldingItems()
  const { status, loading: statusLoading, reload: reloadStatus } = useHotHoldingTodayStatus()

  const now           = new Date()
  const currentPeriod = now.getHours() < 12 ? 'am' : 'pm'
  const [period, setPeriod] = useState(currentPeriod)

  const [showExport, setShowExport]     = useState(false)
  const [newItemName, setNewItemName]   = useState('')
  const [addingItem, setAddingItem]     = useState(false)
  const [openItemId, setOpenItemId]     = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const addInputRef = useRef(null)

  const tabs = isManager ? ['today', 'items', 'history'] : ['today', 'history']
  const tab  = tabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'today'
  const setTab = (next) => setSearchParams(next === 'today' ? {} : { tab: next }, { replace: true })

  const handleAddItem = async () => {
    const name = newItemName.trim()
    if (!name) return
    setAddingItem(true)
    const { error } = await supabase.from('hot_holding_items').insert({ venue_id: venueId, name })
    setAddingItem(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} added`)
    setNewItemName('')
    reloadItems()
    reloadStatus()
  }

  const handleRemoveItem = async (item) => {
    const { error } = await supabase.from('hot_holding_items').update({ is_active: false }).eq('id', item.id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${item.name} removed`)
    setOpenItemId(null)
    reloadItems()
    reloadStatus()
  }

  const handleSaveItemSettings = async (item, values) => {
    const { error } = await supabase
      .from('hot_holding_items')
      .update(values)
      .eq('venue_id', venueId)
      .eq('id', item.id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${values.name} settings saved`)
    setOpenItemId(null)
    reloadItems()
    reloadStatus()
  }

  const goAddItem = () => {
    setTab('items')
    setTimeout(() => addInputRef.current?.focus(), 50)
  }

  if (itemsLoading || statusLoading) {
    return <PageSkeleton />
  }

  // Latest reading per item for each period (logs arrive newest first)
  const latest = { am: {}, pm: {} }
  for (const p of ['am', 'pm']) {
    for (const log of (p === 'am' ? status.amLogs : status.pmLogs) ?? []) {
      latest[p][log.item_id] ??= log
    }
  }
  const dueFor   = (p) => items.filter(item => isCheckRequired(item, now, p))
  const doneFor  = (p) => dueFor(p).filter(item => latest[p][item.id]).length
  const dueNow   = dueFor(currentPeriod).length - doneFor(currentPeriod)
  const periodItems = dueFor(period)

  return (
    <div className="flex flex-col gap-2.5 max-w-3xl">
      <PageHeader
        title="Hot holding"
        backTo={isManager ? `/v/${venueSlug}/checks` : null}
        onExport={() => setShowExport(true)}
      />

      <TabBar
        tabs={tabs.map(id => ({
          id,
          label: { today: "Today's check", items: 'Items', history: 'History' }[id],
          count: id === 'today' ? dueNow : id === 'items' ? items.length : null,
        }))}
        active={tab}
        onChange={setTab}
      />

      <HotHoldingExportModal open={showExport} onClose={() => setShowExport(false)} />
      <ConfirmDialog
        open={!!removeTarget}
        title="Remove item?"
        message={removeTarget ? `Remove "${removeTarget.name}"? Its readings are kept, but it'll no longer show up for checks.` : ''}
        confirmLabel="Remove"
        danger
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { handleRemoveItem(removeTarget); setRemoveTarget(null) }}
      />

      {/* ── Today's check ── */}
      {tab === 'today' && (
        items.length === 0 ? (
          <div className={`${CARD} p-8 text-center flex flex-col items-center gap-2.5`}>
            <p className="text-[13px] text-ink3 dark:text-white/45">
              {isManager ? 'No hot holding items yet.' : 'No hot holding items yet — ask your manager to add them.'}
            </p>
            {isManager && <AddDashedButton label="Add hot holding item" onClick={goAddItem} />}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {['am', 'pm'].map(p => (
                <PeriodCard
                  key={p}
                  period={p}
                  selected={period === p}
                  done={doneFor(p)}
                  total={dueFor(p).length}
                  currentPeriod={currentPeriod}
                  onSelect={() => setPeriod(p)}
                />
              ))}
            </div>

            {periodItems.length === 0 ? (
              <p className={`${CARD} px-3.5 py-6 text-[13px] text-center text-ink3 dark:text-white/45`}>
                Nothing is scheduled for the {PERIOD_NAMES[period].toLowerCase()} today.
              </p>
            ) : (
              <div className={`${CARD} divide-y divide-line dark:divide-white/10`}>
                {periodItems.map(item => {
                  const other = period === 'am' ? 'pm' : 'am'
                  return (
                    <HotHoldingRow
                      key={`${item.id}-${period}`}
                      item={item}
                      period={period}
                      log={latest[period][item.id] ?? null}
                      otherLog={latest[other][item.id] ?? null}
                      otherRequired={isCheckRequired(item, now, other)}
                      session={session}
                      venueId={venueId}
                      onSaved={reloadStatus}
                    />
                  )
                })}
              </div>
            )}

            {isManager && <AddDashedButton label="Add hot holding item" onClick={goAddItem} />}
          </>
        )
      )}

      {/* ── Items (managers) ── */}
      {tab === 'items' && isManager && (
        <>
          <div className="flex gap-2">
            <input
              ref={addInputRef}
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              placeholder="Add item, e.g. Soup, Gravy"
              aria-label="New hot holding item"
              className="flex-1 min-w-0 h-9 px-3.5 rounded-xl border border-line dark:border-white/10 bg-white dark:bg-paperDark text-[13px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
            />
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!newItemName.trim() || addingItem}
              className="h-9 px-3.5 rounded-xl bg-brand text-white text-[13px] font-semibold transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed"
            >
              {addingItem ? '…' : 'Add'}
            </button>
          </div>

          {items.length > 0 && (
            <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
              {items.map(item => (
                <ItemSettingsRow
                  key={item.id}
                  icon={THERMOMETER_ICON}
                  name={item.name}
                  subline={<>
                    <span className="font-mono text-ink2 dark:text-white/65">{rangeLabel(item)}</span>
                    {' · '}{formatCheckDaysCompact(item.check_days)} · {formatRequiredPeriods(item.required_periods)}
                  </>}
                  open={openItemId === item.id}
                  onToggle={() => setOpenItemId(id => (id === item.id ? null : item.id))}
                  onRemove={() => setRemoveTarget(item)}
                  formProps={{
                    item,
                    maxRequired: false,
                    suggestedRange: RANGE_HINT,
                    onSave: (values) => handleSaveItemSettings(item, values),
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── History ── */}
      {tab === 'history' && <HotHoldingHistory />}
    </div>
  )
}
