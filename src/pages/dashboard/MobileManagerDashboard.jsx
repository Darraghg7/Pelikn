/**
 * MobileManagerDashboard — lg:hidden branch of the manager dashboard.
 * Re-skinned to match the manager-dashboard-handoff prototype exactly.
 * Keeps all existing data hooks/registry/DnD — no new persistence model.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { isActionDueToday } from '../../hooks/useTodaySummary'
import { TODAY_ITEM_REGISTRY } from './todayItemRegistry'
import { WIDGET_REGISTRY } from '../../components/widgets/WidgetRegistry'
import { useClockStatus } from '../../hooks/useClockEvents'
import { offlineRpc } from '../../lib/offlineSupabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
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
  verticalListSortingStrategy,
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

// ── Plan pill ──────────────────────────────────────────────────────────────
function MobilePlanPill({ plan }) {
  const isPro = plan === 'pro'
  return (
    <span className={[
      'font-mono text-[11px] tracking-[0.1em] font-bold uppercase px-[7px] py-[2px] rounded-full whitespace-nowrap',
      isPro
        ? 'bg-accent/10 text-accent border border-accent/25'
        : 'bg-success/10 text-success border border-success/25',
    ].join(' ')}>
      {isPro ? 'Pro' : 'Starter'}
    </span>
  )
}

// ── Stat tile (3-col, with sub-label) ─────────────────────────────────────
function subLabel(item, summary) {
  const v = item.metric(summary) ?? 0
  const id = item.id
  if (id === 'on_shift')       return v === 0 ? 'none today' : v === 1 ? '1 in' : 'on shift'
  if (id === 'opening_checks') return v === 0 ? 'not done' : 'complete'
  if (id === 'closing_checks') return v === 0 ? 'not done' : 'complete'
  if (id === 'fridge_checks')  return v === 0 ? 'all done' : `${v} due`
  if (id === 'cleaning_tasks') return v === 0 ? 'all done' : 'overdue'
  if (id === 'critical_actions') return v === 0 ? 'all clear' : 'open'
  if (id === 'pending_leave')  return v === 0 ? '0 requests' : 'pending'
  if (id === 'cooking_temps')  return v === 0 ? 'none logged' : 'logged'
  if (id === 'hot_holding')    return v === 0 ? 'none logged' : 'logged'
  if (id === 'cooling_logs')   return v === 0 ? 'none active' : 'active'
  return null
}

function MobileStatTile({ item, summary }) {
  const value    = item.metric(summary) ?? 0
  const isDanger = item.dangerWhenPositive && value > 0
  const sub      = subLabel(item, summary)

  return (
    <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] p-[10px_11px_11px] flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${isDanger ? 'bg-danger' : 'bg-success'}`} />
        <span className="font-mono text-[9px] tracking-[0.07em] text-charcoal/60 uppercase leading-none">
          {item.metricLabel}
        </span>
      </div>
      <span className={`font-mono text-[26px] font-semibold tracking-[-0.02em] leading-[1.1] ${isDanger ? 'text-danger' : 'text-charcoal'}`}>
        {value}
      </span>
      {sub && (
        <span className={`font-mono text-[11px] tracking-[0.03em] leading-none ${isDanger ? 'text-danger' : 'text-charcoal/50'}`}>
          {sub}
        </span>
      )}
    </div>
  )
}

// ── Section label (floating, mono-uppercase) ───────────────────────────────
function SectionLabel({ children }) {
  return (
    <span className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-charcoal/50 block mb-1.5">
      {children}
    </span>
  )
}

// ── Attention card (all-clear or action list) ──────────────────────────────
function AttentionCard({ actions, editMode }) {
  const isEmpty = actions.length === 0
  return (
    <div className={[
      'bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden transition-opacity duration-200',
      editMode ? 'opacity-45' : 'opacity-100',
    ].join(' ')}>
      {isEmpty ? (
        <div className="flex items-center gap-[13px] p-[14px_16px]">
          <div className="w-10 h-10 rounded-[11px] bg-[#e3f0e7] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold text-charcoal leading-[1.2]">All clear</div>
            <div className="text-[12.5px] text-charcoal/50 mt-0.5">Nothing needs your attention right now.</div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-1.5 p-[12px_16px_8px]">
            <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-charcoal/50 font-semibold">
              Needs You
            </span>
            <span className="min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center px-[5px]">
              {actions.length}
            </span>
          </div>
          <div className="border-t border-charcoal/6">
            {actions.map((a, i) => {
              const urgencyClass = {
                warn:   'border-l-warning text-warning',
                danger: 'border-l-danger text-danger',
                info:   'border-l-[#2c4577] text-[#2c4577]',
              }[a.urgency] ?? 'border-l-warning text-warning'
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className={[
                    'flex items-center border-l-[3px] p-[12px_16px] no-underline',
                    i < actions.length - 1 ? 'border-b border-charcoal/6' : '',
                    urgencyClass,
                  ].join(' ')}
                >
                  <span className="flex-1 text-[13.5px] font-medium leading-[1.3]">
                    {a.label}
                  </span>
                  <span className="font-mono text-[13px] text-charcoal/30">›</span>
                </Link>
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
      'bg-[#7a1d0c] rounded-[14px] p-[12px_16px] flex flex-col gap-2 transition-opacity duration-200',
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
          <span className="flex-1 text-[13px] text-white font-medium leading-[1.35]">
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
    supabase
      .from('clock_events')
      .select('event_type, occurred_at')
      .eq('staff_id', staffId)
      .eq('venue_id', venueId)
      .in('event_type', ['clock_in', 'clock_out'])
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: true })
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
  const { status, clockInAt, breakStartAt, totalBreakMs, loading, reload } = useClockStatus(staffId)
  const [submitting, setSubmitting] = useState(false)
  const elapsed  = useShiftElapsed(clockInAt, breakStartAt, totalBreakMs, status)
  const weekHrs  = useWeeklyHours(staffId, venueId)
  const now      = useLiveTime()

  const record = async (eventType) => {
    setSubmitting(true)
    const { error } = await offlineRpc('record_clock_event', {
      p_staff_id:   staffId,
      p_event_type: eventType,
      p_venue_id:   venueId,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    reload()
  }

  const onShift  = status === 'clocked_in'
  const onBreak  = status === 'on_break'
  const badgeLabel = onBreak
    ? `On Break${elapsed ? ' · ' + elapsed : ''}`
    : onShift
      ? `On Shift${elapsed ? ' · ' + elapsed : ''}`
      : 'Not In'

  const badgeBg  = onBreak ? 'rgba(168,93,18,0.25)' : onShift ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.10)'
  const badgeDot = onBreak ? '#e8a34e' : onShift ? '#6fcfa0' : 'rgba(255,255,255,0.35)'

  return (
    <div>
      <SectionLabel>My Clock</SectionLabel>
      <div className="bg-brand rounded-[14px] p-[14px_16px_16px] flex flex-col gap-0">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-white/60 font-semibold">
            My Clock
          </span>
          <span
            className="flex items-center gap-[5px] rounded-full py-[3px] pl-[7px] pr-[9px]"
            style={{ background: badgeBg }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: badgeDot }} />
            <span className="font-mono text-[11px] font-bold tracking-[0.07em] uppercase text-white/90">
              {badgeLabel}
            </span>
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-mono text-[40px] font-semibold tracking-[-0.03em] text-white leading-none">
            {format(now, 'HH:mm')}
          </span>
          {(onShift || onBreak) && clockInAt && (
            <span className="font-mono text-xs text-white/60 tracking-[0.02em]">
              — since {format(clockInAt, 'HH:mm')}
            </span>
          )}
        </div>

        <div className="h-px bg-white/12 mb-3" />

        <div className="flex gap-5 mb-3.5">
          {[
            { label: 'This Week', value: weekHrs ?? '—' },
            { label: 'Break', value: onBreak && breakStartAt
                ? `${Math.floor((Date.now() - breakStartAt.getTime()) / 60000)} min`
                : totalBreakMs > 0
                  ? `${Math.floor(totalBreakMs / 60000)} min`
                  : '—' },
            { label: 'Last In', value: clockInAt ? format(clockInAt, 'EEE HH:mm') : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-white/55 mb-[3px]">
                {label}
              </div>
              <div className="font-mono text-[13.5px] font-semibold text-white tracking-[-0.01em]">
                {value}
              </div>
            </div>
          ))}
        </div>

        {loading ? null : status === 'clocked_out' ? (
          <button
            onClick={() => record('clock_in')}
            disabled={submitting}
            className={`w-full bg-white text-brand rounded-[11px] py-[13px] font-mono text-[13px] font-bold tracking-[0.02em] border-0 cursor-pointer ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Clock In
          </button>
        ) : status === 'clocked_in' ? (
          <div className="flex gap-2">
            <button
              onClick={() => record('break_start')}
              disabled={submitting}
              className={`flex-1 bg-white/12 text-white/85 border border-white/20 rounded-[11px] py-[13px] font-mono text-xs font-semibold cursor-pointer ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Break
            </button>
            <button
              onClick={() => record('clock_out')}
              disabled={submitting}
              className={`flex-[2] bg-white text-brand rounded-[11px] py-[13px] font-mono text-[13px] font-bold border-0 cursor-pointer flex items-center justify-center gap-[7px] ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="inline-block w-[9px] h-[9px] bg-brand rounded-[2px]" />
              Clock out
            </button>
          </div>
        ) : status === 'on_break' ? (
          <button
            onClick={() => record('break_end')}
            disabled={submitting}
            className={`w-full bg-white text-brand rounded-[11px] py-[13px] font-mono text-[13px] font-bold border-0 cursor-pointer ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            End Break
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
function MobileSortableCard({ id, editMode, children }) {
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
      className="rounded-[14px] relative"
    >
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2.5 right-2.5 z-20 cursor-grab p-1.5 rounded-lg bg-white/92 backdrop-blur-sm shadow-sm text-charcoal/50 flex items-center justify-center"
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
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-[13px]">
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
              <MobileSortableCard key={id} id={id} editMode={editMode}>
                <Comp />
              </MobileSortableCard>
            )
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeContent && (
          <div className="rounded-[14px] opacity-95 cursor-grabbing" style={{ boxShadow: '0 24px 48px rgba(9,18,13,0.25)', transform: 'scale(1.02)' }}>
            {activeContent}
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
  venueName,
  venuePlan,
  venueSlug,
  greeting,
  firstName,
  summary,
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
    supabase
      .from('staff_disciplinary_log')
      .select('id, offence_type, strike_number, occurred_at, staff:staff_id(name)')
      .eq('venue_id', venueId)
      .eq('strike_number', 4)
      .gte('occurred_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('occurred_at', { ascending: false })
      .then(({ data }) => {
        setDisciplinaryAlerts(
          (data ?? []).map(d => ({ ...d, staff_name: d.staff?.name ?? null }))
        )
      })
  }, [venueId])

  const activeItems = (todayItemIds ?? [])
    .map(id => TODAY_ITEM_REGISTRY[id])
    .filter(item => {
      if (!item) return false
      if (item.feature && !isEnabled(item.feature)) return false
      if (item.scheduleKey && !isActionDueToday(item.scheduleKey, actionSchedules)) return false
      return true
    })

  const actions = summary
    ? activeItems.map(item => item.action?.(summary, vp)).filter(Boolean)
    : []

  const checksText = summary
    ? `· ${summary.checksToday} of ${summary.totalChecks} daily checks complete`
    : null

  return (
    <div className="flex flex-col gap-[13px]">

      <PushBanner staffId={session?.staffId} venueId={venueId} />

      <div className="pb-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-charcoal/50 pt-[3px]">
            {format(now, 'EEEE, d MMMM')} · {format(now, 'HH:mm')}
          </span>
          <button
            onClick={() => setEditMode(v => !v)}
            className={[
              'shrink-0 font-mono text-[11px] font-bold tracking-[0.07em] uppercase rounded-lg py-1 px-[11px] cursor-pointer whitespace-nowrap transition-all duration-150',
              editMode
                ? 'text-success bg-[#e3f0e7] border border-success/30'
                : 'text-charcoal/50 bg-transparent border border-charcoal/10',
            ].join(' ')}
          >
            {editMode ? 'Done' : 'Rearrange'}
          </button>
        </div>

        <h1 className="text-[30px] font-bold tracking-[-0.03em] text-charcoal leading-[1.1] mt-[5px] mb-1.5">
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>

        <div className="flex items-center gap-1.5 flex-wrap">
          {venueName && (
            <span className="text-[13px] font-medium text-charcoal/75">{venueName}</span>
          )}
          <MobilePlanPill plan={venuePlan} />
          {checksText && (
            <span className="font-mono text-[11px] text-charcoal/50 tracking-[0.01em]">
              {checksText}
            </span>
          )}
        </div>
      </div>

      <DisciplinaryStrip alerts={disciplinaryAlerts} editMode={editMode} venueSlug={venueSlug} />
      <AttentionCard actions={actions} editMode={editMode} vp={vp} />

      {editMode && (
        <p className="font-mono text-center text-[11px] text-charcoal/30 tracking-[0.04em]">
          Drag widgets to reorder · tap Done when finished
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
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-[84px] rounded-xl bg-charcoal/6 animate-pulse" />
                ))}
              </div>
            ) : activeItems.length === 0 ? (
              <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] p-[20px_16px] text-center">
                <p className="text-[13px] text-charcoal/50">No Today items selected</p>
                <button
                  onClick={onOpenPicker}
                  className="mt-2 text-xs font-semibold text-brand bg-transparent border-0 cursor-pointer"
                >
                  + Add items
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {activeItems.map(item => (
                  <MobileStatTile key={item.id} item={item} summary={summary} />
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
