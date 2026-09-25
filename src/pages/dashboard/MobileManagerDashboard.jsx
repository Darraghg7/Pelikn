/**
 * MobileManagerDashboard — lg:hidden branch of the manager dashboard.
 * Re-skinned to match the manager-dashboard-handoff prototype exactly.
 * Keeps all existing data hooks/registry/DnD — no new persistence model.
 */
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { isActionDueToday } from '../../hooks/useTodaySummary'
import { TODAY_ITEM_REGISTRY } from './todayItemRegistry'
import { WIDGET_REGISTRY } from '../../components/widgets/WidgetRegistry'
import { FetchWhenNearViewport } from '../../hooks/useWidgetFetchGate'
import { useClockStatus, saveClockStatusCache } from '../../hooks/useClockEvents'
import { useClockAlerts } from '../../hooks/useClockAlerts'
import { offlineRpc } from '../../lib/offlineSupabase'
import { fetchUnsignedTrainingCount, unsignedTrainingKey } from '../../lib/api/training'
import { takeBootstrap } from '../../lib/api/bootstrap'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import StaffAlertModal from '../../components/shifts/StaffAlertModal'
import ClosingChecklistGateModal from '../../components/shifts/ClosingChecklistGateModal'
import { useClosingCheckoutGuard } from '../../hooks/useClosingCheckoutGuard'
import PushBanner from './PushBanner'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Live time (updates every minute) ──────────────────────────────────────
function useLiveTime() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

const GLANCE_TILES = ['on_shift', 'opening_checks', 'fridge_checks', 'critical_actions']

// ── Stat tile (4 across, with sub-label) ───────────────────────────────────
// Short names so four fit across a phone; the picker keeps the full labels.
const TILE_LABELS = {
  on_shift: 'On shift', opening_checks: 'Checks', closing_checks: 'Closing', fridge_checks: 'Fridges due',
  cooking_temps: 'Cooking', hot_holding: 'Hot hold', cooling_logs: 'Cooling', cleaning_tasks: 'Cleaning',
  critical_actions: 'Critical', pending_leave: 'Leave', duties: 'Duties',
}

function subLabel(item, summary) {
  const v = item.metric(summary) ?? 0
  const id = item.id
  if (id === 'on_shift')       return v === 0 ? 'none in' : 'on shift'
  if (id === 'opening_checks') return summary.totalChecks > 0 ? `of ${summary.totalChecks} done` : v === 0 ? 'not done' : 'done'
  if (id === 'closing_checks') return v === 0 ? 'not done' : 'done'
  if (id === 'fridge_checks')  return v === 0 ? 'all done' : 'still due'
  if (id === 'cleaning_tasks') return v === 0 ? 'all done' : 'overdue'
  if (id === 'critical_actions') return v === 0 ? 'all clear' : 'open'
  if (id === 'pending_leave')  return v === 0 ? 'none' : 'to review'
  if (id === 'cooking_temps')  return v === 0 ? 'none yet' : 'logged'
  if (id === 'hot_holding')    return v === 0 ? 'none yet' : 'logged'
  if (id === 'cooling_logs')   return v === 0 ? 'none yet' : 'logged'
  if (id === 'duties')         return `${summary.dutiesCompleted ?? 0} done`
  return null
}

function MobileStatTile({ item, summary, vp }) {
  const value    = item.metric(summary) ?? 0
  const isDanger = item.dangerWhenPositive && value > 0
  const sub      = subLabel(item, summary)
  const Tag      = item.route ? Link : 'div'
  const tagProps = item.route ? { to: vp(item.route) } : {}

  return (
    <Tag {...tagProps} className="min-w-0 bg-white dark:bg-paperDark border border-line dark:border-white/10 rounded-2xl px-2.5 min-[420px]:px-3 pt-3 pb-3 flex flex-col gap-1.5 no-underline active:bg-cream dark:active:bg-white/5 transition-colors">
      <span className="flex items-start gap-1.5 min-w-0 min-h-[30px] min-[420px]:min-h-0">
        <span className={`w-2 h-2 mt-1 rounded-full shrink-0 ${isDanger ? 'bg-bad' : 'bg-good'}`} />
        <span className="text-[12px] min-[420px]:text-[13px] text-ink2 dark:text-white/70 leading-tight break-words">
          {TILE_LABELS[item.id] ?? item.metricLabel}
        </span>
      </span>
      <span className={`font-mono text-[24px] font-semibold leading-none ${isDanger ? 'text-bad dark:text-[#f19a86]' : 'text-ink dark:text-white'}`}>
        {value}
      </span>
      {sub && (
        <span className={`text-[12px] min-[420px]:text-[13px] leading-tight ${isDanger ? 'text-bad dark:text-[#f19a86]' : 'text-ink3 dark:text-white/45'}`}>
          {sub}
        </span>
      )}
    </Tag>
  )
}

// ── Section label (floating, mono-uppercase) ───────────────────────────────
function SectionLabel({ children }) {
  return (
    <span className="text-[12px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 block mb-2 px-1">
      {children}
    </span>
  )
}

// ── Attention card (all-clear or "Needs You" action list) ──────────────────
// One dot per row: red for the single most urgent item, amber for the rest.
// At most one row is red — if more than one action is flagged 'danger', only
// the first in display order gets it (tie-break agreed when this card was
// first designed; see the Needs You redesign notes).
function AttentionCard({ actions, editMode }) {
  const isEmpty = actions.length === 0
  const overdueIdx = actions.findIndex(a => a.urgency === 'danger')

  return (
    <div
      className={[
        'rounded-2xl overflow-hidden bg-white dark:bg-paperDark border border-line dark:border-white/10 transition-opacity duration-200',
        editMode ? 'opacity-45' : 'opacity-100',
      ].join(' ')}
    >
      {isEmpty ? (
        <div className="flex items-center gap-3.5 px-4 sm:px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-goodBg dark:bg-good/20 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-good dark:text-[#7fd1a4]">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold text-ink dark:text-white">All clear</div>
            <div className="text-[13px] text-ink3 dark:text-white/45 mt-0.5">Nothing needs your attention right now.</div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2.5 px-4 sm:px-4 py-2.5">
            <span className="text-[12px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">Needs you</span>
            <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-bad text-white text-[12px] font-bold inline-flex items-center justify-center">
              {actions.length}
            </span>
          </div>
          <div className="divide-y divide-line dark:divide-white/10 border-t border-line dark:border-white/10">
            {actions.map((a, i) => {
              const isOverdue = i === overdueIdx
              const Row = a.to ? Link : 'div'
              return (
                <Row
                  key={a.to ?? a.label}
                  {...(a.to ? { to: a.to } : {})}
                  className="flex items-center gap-3.5 px-4 sm:px-4 py-2.5 no-underline active:bg-cream dark:active:bg-white/5 transition-colors"
                >
                  <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${isOverdue ? 'bg-bad' : 'bg-warn'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-ink dark:text-white">{a.label}</span>
                    {a.detail && <span className="block text-[13px] text-ink3 dark:text-white/45 mt-0.5">{a.detail}</span>}
                  </span>
                  {a.to && (
                    <svg className="shrink-0 w-4 h-4 text-ink4 dark:text-white/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  )}
                </Row>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Disciplinary strip ─────────────────────────────────────────────────────
function DisciplinaryStrip({ alerts, editMode, venueSlug }) {
  if (!alerts.length) return null
  return (
    <div className={[
      'bg-severe rounded-[14px] p-[12px_16px] flex flex-col gap-2 transition-opacity duration-200',
      editMode ? 'opacity-45' : 'opacity-100',
    ].join(' ')}>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-white/65 font-semibold">
          Disciplinary Review
        </span>
        <span className="min-w-[18px] h-[18px] rounded-full bg-white/20 text-white text-[11px] font-bold flex items-center justify-center px-[5px]">
          {alerts.length}
        </span>
      </div>
      {alerts.map((a) => (
        <Link
          key={a.id}
          to={`/v/${venueSlug}/timesheet`}
          className="flex items-center gap-2 bg-white/10 rounded-[10px] p-[9px_12px] no-underline"
        >
          <span className="flex-1 text-[12px] text-white font-medium leading-[1.35]">
            {a.staff_name ?? 'Staff member'} —{' '}
            {a.offence_type === 'late_clock_in' ? 'late clock-in' : 'break overrun'},{' '}
            strike {a.strike_number}
          </span>
          <span className="font-mono text-[12px] text-white/50">›</span>
        </Link>
      ))}
    </div>
  )
}

// ── Live shift elapsed (Xh Ym format) ─────────────────────────────────────
function useShiftElapsed(clockInAt, breakStartAt, totalBreakMs, status) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  if (!clockInAt) return null
  const curBreak = status === 'on_break' && breakStartAt
    ? now - breakStartAt.getTime() : 0
  const ms = now - clockInAt.getTime() - totalBreakMs - curBreak
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Weekly hours for a staff member ───────────────────────────────────────
function useWeeklyHours(staffId, venueId) {
  const [hours, setHours] = useState(null)
  useEffect(() => {
    if (!staffId || !venueId) return
    const since = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
    // First load comes from the startup bundle when it's available (126).
    takeBootstrap(venueId, 'weeklyHours', staffId)
      .then(boot => boot
        ? { data: boot.week_clock }
        : supabase
          .from('clock_events')
          .select('event_type, occurred_at')
          .eq('staff_id', staffId)
          .eq('venue_id', venueId)
          .in('event_type', ['clock_in', 'clock_out'])
          .gte('occurred_at', since)
          .order('occurred_at', { ascending: true }))
      .then(({ data }) => {
        if (!data) return
        let total = 0, lastIn = null
        for (const ev of data) {
          if (ev.event_type === 'clock_in')  lastIn = new Date(ev.occurred_at)
          if (ev.event_type === 'clock_out' && lastIn) {
            total += new Date(ev.occurred_at) - lastIn
            lastIn = null
          }
        }
        if (lastIn) total += Date.now() - lastIn.getTime()
        const h = Math.floor(total / 3600000)
        const m = Math.floor((total % 3600000) / 60000)
        setHours(`${h}h ${m}m`)
      })
  }, [staffId, venueId])
  return hours
}

// ── My Clock card (full hero) ──────────────────────────────────────────────
function MobileClockCard({ staffId }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { status, clockInAt, breakStartAt, totalBreakMs, loading, isError, reload } = useClockStatus(staffId)
  const [submitting, setSubmitting] = useState(false)
  const elapsed  = useShiftElapsed(clockInAt, breakStartAt, totalBreakMs, status)
  const weekHrs  = useWeeklyHours(staffId, venueId)
  const now      = useLiveTime()

  // Same late clock-in / break-overrun alerts as ClockPanel. This card used to
  // call the RPC and nothing else, so a manager clocking in late on a phone was
  // never shown the reason / manager-approval screen.
  const recordRef = useRef(null)
  const { onClockEvent, alertModalProps } = useClockAlerts({
    staffId,
    status,
    breakStartAt,
    onEndBreak: useCallback(() => recordRef.current?.('break_end'), []),
  })

  const record = useCallback(async (eventType) => {
    // Captured before the RPC so a slow round trip can't make a punctual
    // clock-in look late.
    const at = new Date()
    setSubmitting(true)
    const { error, queued } = await offlineRpc('record_clock_event', {
      p_staff_id:   staffId,
      p_event_type: eventType,
      p_venue_id:   venueId,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }

    // Mirror the offline cache write ClockPanel does. Without it a clock event
    // saved offline from this card showed here and nowhere else: every other
    // surface reads the cached status, so the card reverted to the old state as
    // soon as anything refetched, and stayed wrong until the queue drained.
    if (queued) {
      let newStatus = status, newClockInAt = clockInAt, newBreakStartAt = breakStartAt, newTotalBreakMs = totalBreakMs
      if (eventType === 'clock_in')    { newStatus = 'clocked_in';  newClockInAt = at }
      if (eventType === 'clock_out')   { newStatus = 'clocked_out'; newClockInAt = null; newBreakStartAt = null; newTotalBreakMs = 0 }
      if (eventType === 'break_start') { newStatus = 'on_break';    newBreakStartAt = at }
      if (eventType === 'break_end')   { newStatus = 'clocked_in';  newTotalBreakMs += breakStartAt ? at - breakStartAt : 0; newBreakStartAt = null }
      saveClockStatusCache(staffId, { status: newStatus, clockInAt: newClockInAt, breakStartAt: newBreakStartAt, totalBreakMs: newTotalBreakMs })
    }

    reload()
    await onClockEvent(eventType, { queued, at })
  }, [staffId, venueId, toast, status, clockInAt, breakStartAt, totalBreakMs, reload, onClockEvent])

  recordRef.current = record

  const closingGuard = useClosingCheckoutGuard({
    staffId,
    onProceed: useCallback(() => record('clock_out'), [record]),
  })

  const onShift  = status === 'clocked_in'
  const onBreak  = status === 'on_break'
  const badgeLabel = isError
    ? 'Status unknown'
    : onBreak
      ? `On break${elapsed ? ' · ' + elapsed : ''}`
      : onShift
        ? `On shift${elapsed ? ' · ' + elapsed : ''}`
        : 'Not in'

  const badgeBg  = isError ? 'rgba(220,38,38,0.25)' : onBreak ? 'rgba(168,93,18,0.25)' : onShift ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.10)'
  const badgeDot = isError ? '#dc2626' : onBreak ? '#e8a34e' : onShift ? '#6fcfa0' : 'rgba(255,255,255,0.35)'

  const stats = [
    { label: 'This week', value: weekHrs ? weekHrs.replace(/h (\d)m$/, 'h 0$1m') : '—' },
    { label: 'Break', value: onBreak && breakStartAt
        ? `${Math.floor((Date.now() - breakStartAt.getTime()) / 60000)} min`
        : totalBreakMs > 0
          ? `${Math.floor(totalBreakMs / 60000)} min`
          : '—' },
    { label: 'Last in', value: clockInAt ? format(clockInAt, 'EEE HH:mm') : '—' },
  ]
  const primaryBtn = `w-full h-11 rounded-2xl bg-white text-brand text-[15px] font-semibold border-0 cursor-pointer ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`

  return (
    <div>
      <StaffAlertModal {...alertModalProps} />
      <ClosingChecklistGateModal {...closingGuard.modalProps} />
      <div className="bg-brand rounded-2xl px-4 sm:px-4 pt-3 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="font-mono text-[30px] min-[420px]:text-[34px] font-semibold tracking-tight text-white leading-none">
              {format(now, 'HH:mm')}
            </span>
            <span className="text-[12px] min-[420px]:text-[12px] font-semibold tracking-[0.06em] uppercase text-white/60 whitespace-nowrap">My clock</span>
          </div>
          <span className="shrink-0 flex items-center gap-2 rounded-full h-8 px-3" style={{ background: badgeBg }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: badgeDot }} />
            <span className="text-[13px] font-semibold text-white whitespace-nowrap">{badgeLabel}</span>
          </span>
        </div>
        {(onShift || onBreak) && clockInAt && (
          <p className="text-[13px] text-white/60 mt-1.5">Since {format(clockInAt, 'HH:mm')}</p>
        )}

        <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <div className="text-[13px] text-white/60 mb-1">{label}</div>
              <div className="font-mono text-[15px] font-semibold text-white truncate">{value}</div>
            </div>
          ))}
        </div>

        {loading ? null : isError ? (
          <button
            onClick={reload}
            className="w-full h-11 rounded-2xl bg-bad/20 text-white text-[14px] font-semibold border border-bad/50 cursor-pointer"
          >
            Couldn't check status — retry
          </button>
        ) : status === 'clocked_out' ? (
          <button onClick={() => record('clock_in')} disabled={submitting} className={primaryBtn}>
            Clock in
          </button>
        ) : status === 'clocked_in' ? (
          <div className="flex gap-2.5">
            <button
              onClick={() => record('break_start')}
              disabled={submitting}
              className={`flex-1 h-11 rounded-2xl bg-white/12 text-white border border-white/25 text-[15px] font-semibold cursor-pointer ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Break
            </button>
            <button onClick={closingGuard.guardClockOut} disabled={submitting} className={`${primaryBtn} flex-[2] flex items-center justify-center gap-2`}>
              <span className="inline-block w-2.5 h-2.5 bg-brand rounded-[2px]" />
              Clock out
            </button>
          </div>
        ) : status === 'on_break' ? (
          <button onClick={() => record('break_end')} disabled={submitting} className={primaryBtn}>
            End break
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ── Grip handle ────────────────────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9"  cy="5"  r="1.5" /><circle cx="15" cy="5"  r="1.5" />
      <circle cx="9"  cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9"  cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

// ── Sortable wrapper for any card (special or registry) ───────────────────
function MobileSortableCard({ id, editMode, half = false, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform:    CSS.Transform.toString(transform),
        transition,
        opacity:      isDragging ? 0.35 : 1,
        outline:      editMode ? '1.5px dashed rgb(179 185 181)' : 'none',
        outlineOffset: 2,
      }}
      className={`rounded-2xl relative min-w-0 ${half ? 'col-span-1' : 'col-span-2'}`}
    >
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2.5 right-2.5 z-20 cursor-grab p-1.5 rounded-lg bg-white/92 backdrop-blur-sm shadow-sm text-charcoal/50 dark:text-white/40 flex items-center justify-center"
        >
          <GripIcon />
        </div>
      )}
      <div className={editMode ? 'pointer-events-none' : 'pointer-events-auto'}>
        {children}
      </div>
    </div>
  )
}

// ── DnD list — stats + clock + registry widgets all reorderable ────────────
const STORAGE_KEY = 'mgr.dash.order.v1'
const DEFAULT_FIXED = ['stats', 'clock']

function MobileDraggableWidgetGrid({
  widgetIds, onReorder, editMode,
  statsContent, clockContent,
}) {
  const [ids, setIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (Array.isArray(saved) && saved.length) {
        const extras = widgetIds.filter(id => !saved.includes(id))
        return [...saved.filter(id => id === 'stats' || id === 'clock' || widgetIds.includes(id)), ...extras]
      }
    } catch (_) {}
    return [...DEFAULT_FIXED, ...widgetIds]
  })

  const [activeId, setActiveId] = useState(null)

  const prevWidgetIds = useRef(widgetIds)
  useEffect(() => {
    if (prevWidgetIds.current === widgetIds) return
    prevWidgetIds.current = widgetIds
    setIds(prev => {
      const existing = new Set(prev)
      const added    = widgetIds.filter(id => !existing.has(id))
      const next     = [...prev.filter(id => id === 'stats' || id === 'clock' || widgetIds.includes(id)), ...added]
      return next
    })
  }, [widgetIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = ({ active }) => setActiveId(active.id)
  const handleDragEnd   = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    setIds(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id))
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch (_) {}
      onReorder(next.filter(id => id !== 'stats' && id !== 'clock'))
      return next
    })
  }

  const activeContent = activeId === 'stats'
    ? statsContent
    : activeId === 'clock'
      ? clockContent
      : activeId && WIDGET_REGISTRY[activeId]
        ? React.createElement(WIDGET_REGISTRY[activeId].component)
        : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3">
          {ids.map(id => {
            if (id === 'stats') return (
              <MobileSortableCard key="stats" id="stats" editMode={editMode}>
                {statsContent}
              </MobileSortableCard>
            )
            if (id === 'clock') return (
              <MobileSortableCard key="clock" id="clock" editMode={editMode}>
                {clockContent}
              </MobileSortableCard>
            )
            const widget = WIDGET_REGISTRY[id]
            if (!widget) return null
            const Comp = widget.component
            return (
              <MobileSortableCard key={id} id={id} editMode={editMode} half={!!widget.mobileHalf}>
                {/* Below-the-fold cards wait to fetch until they're nearly on
                    screen, keeping them out of the cold-open request burst. */}
                <FetchWhenNearViewport>
                  <Suspense fallback={<div className="h-[120px] rounded-2xl bg-line2 dark:bg-white/8 border border-line dark:border-white/10 animate-pulse" />}>
                    <Comp />
                  </Suspense>
                </FetchWhenNearViewport>
              </MobileSortableCard>
            )
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeContent && (
          <div className="rounded-[14px] opacity-95 cursor-grabbing" style={{ boxShadow: '0 24px 48px rgba(9,18,13,0.25)', transform: 'scale(1.02)' }}>
            <Suspense fallback={null}>
              {activeContent}
            </Suspense>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ── Main export ────────────────────────────────────────────────────────────
export default function MobileManagerDashboard({
  session,
  venueId,
  venueSlug,
  greeting,
  firstName,
  summary,
  closedToday,
  widgetIds,
  onReorder,
  todayItemIds,
  actionSchedules,
  onOpenPicker,
  isEnabled,
}) {
  const now     = useLiveTime()
  const [editMode, setEditMode]               = useState(false)
  const [disciplinaryAlerts, setDisciplinaryAlerts] = useState([])

  const vp = (p) => `/v/${venueSlug}${p}`

  useEffect(() => {
    if (!venueId) return
    // First load comes from the startup bundle when it's available (126).
    takeBootstrap(venueId, 'disciplinary')
      .then(boot => boot
        ? { data: boot.disciplinary }
        : supabase
          .from('staff_disciplinary_log')
          .select('id, offence_type, strike_number, occurred_at, staff:staff_id(name)')
          .eq('venue_id', venueId)
          .eq('strike_number', 4)
          .gte('occurred_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('occurred_at', { ascending: false }))
      .then(({ data }) => {
        setDisciplinaryAlerts(
          (data ?? []).map(d => ({ ...d, staff_name: d.staff?.name ?? null }))
        )
      })
  }, [venueId])

  // Training records awaiting a staff signature — surfaced in Needs You
  // alongside the customizable Today items, same as disciplinary alerts.
  // Shared key with the Staff Notifications widget, which shows the same count.
  const { data: unsignedTraining = 0 } = useQuery({
    queryKey: unsignedTrainingKey(venueId),
    queryFn: () => fetchUnsignedTrainingCount(venueId),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  const activeItems = (todayItemIds ?? [])
    .map(id => TODAY_ITEM_REGISTRY[id])
    .filter(item => {
      if (!item) return false
      if (item.feature && !isEnabled(item.feature)) return false
      if (item.scheduleKey && !isActionDueToday(item.scheduleKey, actionSchedules)) return false
      return true
    })

  // Today at a glance is a fixed four; the rest of the Today items surface in
  // Needs you when they need attention.
  const glanceItems = GLANCE_TILES
    .map(id => TODAY_ITEM_REGISTRY[id])
    .filter(item => item && (!item.feature || isEnabled(item.feature)))

  const actions = summary
    ? activeItems.map(item => item.action?.(summary, vp, closedToday)).filter(Boolean)
    : []
  if (unsignedTraining > 0) {
    actions.push({
      label: `${unsignedTraining} training record${unsignedTraining > 1 ? 's' : ''} unsigned`,
      to: vp('/training'),
      urgency: 'info',
    })
  }

  return (
    <div className="flex flex-col gap-3">

      <PushBanner staffId={session?.staffId} venueId={venueId} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 font-mono text-[12px] min-[420px]:text-[13px] text-ink3 dark:text-white/45 whitespace-nowrap truncate">
            {format(now, 'EEEE, d MMMM')} · {format(now, 'HH:mm')}
          </span>
          <button
            type="button"
            onClick={() => setEditMode(v => !v)}
            className={[
              'shrink-0 h-9 px-4 rounded-xl border text-[13px] font-semibold cursor-pointer transition-colors',
              editMode
                ? 'bg-goodBg text-good border-good/30 dark:bg-good/20 dark:text-[#7fd1a4]'
                : 'bg-white dark:bg-paperDark text-ink2 dark:text-white/80 border-line dark:border-white/10 hover:border-ink4',
            ].join(' ')}
          >
            {editMode ? 'Done' : 'Rearrange'}
          </button>
        </div>

        <h1 className="text-[24px] min-[420px]:text-[28px] font-bold tracking-tight text-ink dark:text-white leading-tight mt-2">
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>
      </div>

      <DisciplinaryStrip alerts={disciplinaryAlerts} editMode={editMode} venueSlug={venueSlug} />
      <AttentionCard actions={actions} editMode={editMode} vp={vp} />

      {editMode && onOpenPicker && (
        <button
          type="button"
          onClick={onOpenPicker}
          className="self-center h-9 px-4 rounded-xl border border-line dark:border-white/10 bg-white dark:bg-paperDark text-[13px] font-semibold text-ink2 dark:text-white/80 hover:border-ink4"
        >
          Choose Needs you items
        </button>
      )}
      {editMode && (
        <p className="text-center text-[13px] text-ink3 dark:text-white/45">
          Drag cards to reorder · tap Done when finished
        </p>
      )}

      <MobileDraggableWidgetGrid
        widgetIds={widgetIds}
        onReorder={onReorder}
        editMode={editMode}
        statsContent={
          <div>
            <SectionLabel>Today at a glance</SectionLabel>
            {!summary ? (
              <div className="grid grid-cols-4 gap-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-[84px] rounded-2xl bg-line2 dark:bg-white/8 border border-line dark:border-white/10 animate-pulse" />
                ))}
              </div>
            ) : glanceItems.length === 0 ? null : (
              <div className="grid grid-cols-4 gap-2">
                {glanceItems.map(item => (
                  <MobileStatTile key={item.id} item={item} summary={summary} vp={vp} />
                ))}
              </div>
            )}
          </div>
        }
        clockContent={<MobileClockCard staffId={session?.staffId} />}
      />
    </div>
  )
}
