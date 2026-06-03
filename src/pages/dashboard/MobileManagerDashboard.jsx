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

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  ink:    '#0d1a14',
  ink2:   '#3d4a44',
  ink3:   '#76817b',
  ink4:   '#b3b9b5',
  line:   '#e4e6e2',
  line2:  '#eef0ec',
  bg:     '#f3f3ef',
  paper:  '#ffffff',
  brand:  '#13362a',
  good:   '#1a7a4c',  goodBg:  '#e3f0e7',
  warn:   '#a85d12',  warnBg:  '#fbeedc',
  bad:    '#b3331c',  badBg:   '#fbeae6',
  info:   '#2c4577',  infoBg:  '#e7edf6',
  accent: '#c94f2a',
  severe: '#7a1d0c',
}

const MONO = "'Geist Mono', ui-monospace, monospace"

function card(extra = {}) {
  return {
    background: T.paper,
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    ...extra,
  }
}

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
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: '0.1em',
        fontWeight: 700,
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 999,
        background: isPro ? `${T.accent}18` : `${T.good}18`,
        color: isPro ? T.accent : T.good,
        border: `1px solid ${isPro ? T.accent + '40' : T.good + '40'}`,
        whiteSpace: 'nowrap',
      }}
    >
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
  const isGood   = item.dangerWhenPositive && value === 0
  const dotColor = isDanger ? T.bad : isGood ? T.good : T.good
  const numColor = isDanger ? T.bad : T.ink
  const sub      = subLabel(item, summary)

  return (
    <div
      style={{
        ...card(),
        padding: '10px 11px 11px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{
          fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.07em',
          color: T.ink3, textTransform: 'uppercase', lineHeight: 1,
        }}>
          {item.metricLabel}
        </span>
      </div>
      <span style={{
        fontFamily: MONO, fontSize: 26, fontWeight: 600,
        letterSpacing: '-0.02em', lineHeight: 1.1, color: numColor,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{
          fontFamily: MONO, fontSize: 9, color: isDanger ? T.bad : T.ink3,
          letterSpacing: '0.03em', lineHeight: 1,
        }}>
          {sub}
        </span>
      )}
    </div>
  )
}

// ── Section label (floating, mono-uppercase) ───────────────────────────────
function SectionLabel({ children }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9.5, fontWeight: 600,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: T.ink3, display: 'block', marginBottom: 6,
    }}>
      {children}
    </span>
  )
}

// ── Attention card (all-clear or action list) ──────────────────────────────
function AttentionCard({ actions, editMode, vp }) {
  const isEmpty = actions.length === 0
  return (
    <div
      style={{
        ...card({ overflow: 'hidden' }),
        opacity: editMode ? 0.45 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {isEmpty ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, background: T.goodBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.good} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.2 }}>All clear</div>
            <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 2 }}>Nothing needs your attention right now.</div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px 8px' }}>
            <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink3, fontWeight: 600 }}>
              Needs You
            </span>
            <span style={{
              minWidth: 18, height: 18, borderRadius: 999,
              background: T.bad, color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
            }}>
              {actions.length}
            </span>
          </div>
          <div style={{ borderTop: `1px solid ${T.line2}` }}>
            {actions.map((a, i) => {
              const colors = {
                warn:   { border: T.warn, text: T.warn },
                danger: { border: T.bad,  text: T.bad  },
                info:   { border: T.info, text: T.info },
              }
              const s = colors[a.urgency] ?? colors.warn
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  style={{
                    display: 'flex', alignItems: 'center',
                    borderLeft: `3px solid ${s.border}`,
                    padding: '12px 16px',
                    borderBottom: i < actions.length - 1 ? `1px solid ${T.line2}` : 'none',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: s.text, lineHeight: 1.3 }}>
                    {a.label}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: T.ink4 }}>›</span>
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
    <div style={{
      background: T.severe,
      borderRadius: 14,
      padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: editMode ? 0.45 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
          Disciplinary Review
        </span>
        <span style={{
          minWidth: 18, height: 18, borderRadius: 999,
          background: 'rgba(255,255,255,0.2)', color: '#fff',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>
          {alerts.length}
        </span>
      </div>
      {alerts.map((a) => (
        <Link
          key={a.id}
          to={`/v/${venueSlug}/timesheet`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '9px 12px',
            textDecoration: 'none',
          }}
        >
          <span style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: 500, lineHeight: 1.35 }}>
            {a.staff_name ?? 'Staff member'} —{' '}
            {a.offence_type === 'late_clock_in' ? 'late clock-in' : 'break overrun'},{' '}
            strike {a.strike_number}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>›</span>
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
        // add current open shift
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

  // Status badge
  const onShift  = status === 'clocked_in'
  const onBreak  = status === 'on_break'
  const badgeLabel = onBreak
    ? `On Break${elapsed ? ' · ' + elapsed : ''}`
    : onShift
      ? `On Shift${elapsed ? ' · ' + elapsed : ''}`
      : 'Not In'
  const badgeBg = onBreak ? 'rgba(168,93,18,0.25)' : onShift ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.10)'
  const badgeDot = onBreak ? '#e8a34e' : onShift ? '#6fcfa0' : 'rgba(255,255,255,0.35)'

  return (
    <div>
      <SectionLabel>My Clock</SectionLabel>
      <div style={{
        background: T.brand,
        borderRadius: 14,
        padding: '14px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* Header row: MY CLOCK label + status pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            My Clock
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: badgeBg, borderRadius: 999,
            padding: '3px 9px 3px 7px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: badgeDot, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
              {badgeLabel}
            </span>
          </span>
        </div>

        {/* Large current time */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
            {format(now, 'HH:mm')}
          </span>
          {(onShift || onBreak) && clockInAt && (
            <span style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em' }}>
              — since {format(clockInAt, 'HH:mm')}
            </span>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 12 }} />

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
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
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Action button(s) */}
        {loading ? null : status === 'clocked_out' ? (
          <button
            onClick={() => record('clock_in')}
            disabled={submitting}
            style={{ width: '100%', background: '#fff', color: T.brand, borderRadius: 11, padding: '13px 0', fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}
          >
            Clock In
          </button>
        ) : status === 'clocked_in' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => record('break_start')}
              disabled={submitting}
              style={{ flex: 1, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 11, padding: '13px 0', fontFamily: MONO, fontSize: 12, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}
            >
              Break
            </button>
            <button
              onClick={() => record('clock_out')}
              disabled={submitting}
              style={{ flex: 2, background: '#fff', color: T.brand, borderRadius: 11, padding: '13px 0', fontFamily: MONO, fontSize: 13, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <span style={{ display: 'inline-block', width: 9, height: 9, background: T.brand, borderRadius: 2 }} />
              Clock out
            </button>
          </div>
        ) : status === 'on_break' ? (
          <button
            onClick={() => record('break_end')}
            disabled={submitting}
            style={{ width: '100%', background: '#fff', color: T.brand, borderRadius: 11, padding: '13px 0', fontFamily: MONO, fontSize: 13, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}
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
        borderRadius: 14,
        outline:      editMode ? `1.5px dashed ${T.ink4}` : 'none',
        outlineOffset: 2,
        position:     'relative',
      }}
    >
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 20,
            cursor: 'grab', padding: 6, borderRadius: 8,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)', color: T.ink3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <GripIcon />
        </div>
      )}
      <div style={{ pointerEvents: editMode ? 'none' : 'auto' }}>
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
  // special card content rendered by parent
  statsContent, clockContent,
}) {
  const [ids, setIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (Array.isArray(saved) && saved.length) {
        // ensure any new widgetIds not in saved are appended
        const extras = widgetIds.filter(id => !saved.includes(id))
        return [...saved.filter(id => id === 'stats' || id === 'clock' || widgetIds.includes(id)), ...extras]
      }
    } catch (_) {}
    return [...DEFAULT_FIXED, ...widgetIds]
  })

  const [activeId, setActiveId] = useState(null)

  // keep in sync if parent widgetIds changes (e.g. widget added/removed)
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
      // notify parent about registry widget order only
      onReorder(next.filter(id => id !== 'stats' && id !== 'clock'))
      return next
    })
  }

  // snapshot for DragOverlay
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
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
          <div style={{ borderRadius: 14, boxShadow: '0 24px 48px rgba(9,18,13,0.25)', transform: 'scale(1.02)', opacity: 0.95, cursor: 'grabbing' }}>
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

  // 4th-strike disciplinary records from the last 7 days
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

  // Active stat items + action list
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

      <PushBanner staffId={session?.staffId} venueId={venueId} />

      {/* ── Greeting (no card — text on bg surface) ─────────────────────── */}
      <div style={{ paddingBottom: 2 }}>
        {/* Row 1: date + REARRANGE */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: T.ink3, paddingTop: 3,
          }}>
            {format(now, 'EEEE, d MMMM')} · {format(now, 'HH:mm')}
          </span>
          <button
            onClick={() => setEditMode(v => !v)}
            style={{
              flexShrink: 0, fontFamily: MONO,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: editMode ? T.good : T.ink3,
              background: editMode ? T.goodBg : 'transparent',
              border: `1px solid ${editMode ? T.good + '50' : T.line}`,
              borderRadius: 8, padding: '4px 11px',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
          >
            {editMode ? 'Done' : 'Rearrange'}
          </button>
        </div>

        {/* H1 */}
        <h1 style={{
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em',
          color: T.ink, lineHeight: 1.1, margin: '5px 0 6px',
        }}>
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>

        {/* Row 3: venue · PRO · checks */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {venueName && (
            <span style={{ fontSize: 13, fontWeight: 500, color: T.ink2 }}>{venueName}</span>
          )}
          <MobilePlanPill plan={venuePlan} />
          {checksText && (
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: T.ink3, letterSpacing: '0.01em' }}>
              {checksText}
            </span>
          )}
        </div>
      </div>

      {/* ── Pinned alerts ───────────────────────────────────────────────── */}
      <DisciplinaryStrip alerts={disciplinaryAlerts} editMode={editMode} venueSlug={venueSlug} />
      <AttentionCard actions={actions} editMode={editMode} vp={vp} />

      {/* ── Edit-mode hint ──────────────────────────────────────────────── */}
      {editMode && (
        <p style={{ fontFamily: MONO, textAlign: 'center', fontSize: 10, color: T.ink4, letterSpacing: '0.04em' }}>
          Drag widgets to reorder · tap Done when finished
        </p>
      )}

      {/* ── All reorderable cards (stats, clock, registry widgets) ──────── */}
      <MobileDraggableWidgetGrid
        widgetIds={widgetIds}
        onReorder={onReorder}
        editMode={editMode}
        statsContent={
          <div>
            <SectionLabel>Today at a glance</SectionLabel>
            {!summary ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ height: 84, borderRadius: 12, background: T.line2 }} className="animate-pulse" />
                ))}
              </div>
            ) : activeItems.length === 0 ? (
              <div style={{ ...card(), padding: '20px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.ink3 }}>No Today items selected</p>
                <button
                  onClick={onOpenPicker}
                  style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: T.brand, background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  + Add items
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
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
