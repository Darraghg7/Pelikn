/**
 * MobileManagerDashboard — lg:hidden branch of the manager dashboard.
 * Re-skin per the forest/Geist design spec. Desktop layout is unchanged.
 * Uses existing hooks, registry, and @dnd-kit setup — no new persistence model.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { isActionDueToday } from '../../hooks/useTodaySummary'
import { TODAY_ITEM_REGISTRY } from './todayItemRegistry'
import { WIDGET_REGISTRY } from '../../components/widgets/WidgetRegistry'
import ClockPanel from '../../components/shifts/ClockPanel'
import GettingStartedCard from './GettingStartedCard'
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

// ── Design tokens (spec-exact) ────────────────────────────────────────────
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

function card(extra = {}) {
  return {
    background:   T.paper,
    border:       `1px solid ${T.line}`,
    borderRadius: 14,
    ...extra,
  }
}

// ── Live time (updates every minute) ─────────────────────────────────────
function useLiveTime() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ── Plan pill ─────────────────────────────────────────────────────────────
function MobilePlanPill({ plan }) {
  const isPro = plan === 'pro'
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 9.5,
        letterSpacing: '0.1em',
        fontWeight: 600,
        textTransform: 'uppercase',
        padding: '2px 8px',
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

// ── Stat tile ─────────────────────────────────────────────────────────────
function MobileStatTile({ item, summary }) {
  const value    = item.metric(summary) ?? 0
  const isDanger = item.dangerWhenPositive && value > 0
  const isGood   = item.dangerWhenPositive && value === 0
  const dotColor = isDanger ? T.bad : isGood ? T.good : T.ink4
  const numColor = isDanger ? T.bad : T.ink

  return (
    <div
      style={{
        ...card(),
        padding:        '12px 14px',
        minHeight:      88,
        display:        'flex',
        flexDirection:  'column',
        gap:            8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span
          style={{
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   dotColor,
            flexShrink:   0,
          }}
        />
        <span
          className="font-mono"
          style={{ fontSize: 9.5, letterSpacing: '0.08em', color: T.ink3, lineHeight: 1, textTransform: 'uppercase' }}
        >
          {item.metricLabel}
        </span>
      </div>
      <span
        className="font-mono tabular-nums"
        style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, color: numColor }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Disciplinary strip (pinned, 4th-strike) ───────────────────────────────
function DisciplinaryStrip({ alerts, editMode, venueSlug }) {
  if (!alerts.length) return null
  return (
    <div
      style={{
        background:    T.severe,
        borderRadius:  14,
        padding:       '12px 16px',
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        opacity:       editMode ? 0.45 : 1,
        transition:    'opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          className="font-mono"
          style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}
        >
          Disciplinary Review
        </span>
        <span
          style={{
            minWidth: 18, height: 18, borderRadius: 999,
            background: 'rgba(255,255,255,0.2)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}
        >
          {alerts.length}
        </span>
      </div>
      {alerts.map((a) => (
        <Link
          key={a.id}
          to={`/v/${venueSlug}/timesheet`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background:    'rgba(255,255,255,0.1)',
            borderRadius:  10,
            padding:       '9px 12px',
            textDecoration:'none',
          }}
        >
          <span style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: 500, lineHeight: 1.35 }}>
            {a.staff_name ?? 'Staff member'} —{' '}
            {a.offence_type === 'late_clock_in' ? 'late clock-in' : 'break overrun'},{' '}
            strike {a.strike_number}
          </span>
          <span className="font-mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>›</span>
        </Link>
      ))}
    </div>
  )
}

// ── Needs You action list (pinned, non-reorderable) ────────────────────────
const URGENCY = {
  warn:   { border: T.warn,  text: T.warn,  bg: T.warnBg },
  danger: { border: T.bad,   text: T.bad,   bg: T.badBg  },
  info:   { border: T.info,  text: T.info,  bg: T.infoBg },
}

function NeedsYouSection({ actions, editMode }) {
  if (!actions.length) return null
  return (
    <div
      style={{
        ...card({ overflow: 'hidden' }),
        opacity:    editMode ? 0.45 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px 8px' }}>
        <span
          className="font-mono"
          style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink3, fontWeight: 600 }}
        >
          Needs You
        </span>
        <span
          style={{
            minWidth: 18, height: 18, borderRadius: 999,
            background: T.bad, color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}
        >
          {actions.length}
        </span>
      </div>
      <div style={{ borderTop: `1px solid ${T.line2}` }}>
        {actions.map((a) => {
          const s = URGENCY[a.urgency] ?? URGENCY.warn
          return (
            <Link
              key={a.to}
              to={a.to}
              style={{
                display:        'flex',
                alignItems:     'center',
                borderLeft:     `3px solid ${s.border}`,
                padding:        '12px 16px',
                borderBottom:   `1px solid ${T.line2}`,
                textDecoration: 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: s.text, lineHeight: 1.3 }}>
                {a.label}
              </span>
              <span className="font-mono" style={{ fontSize: 13, color: T.ink4 }}>›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Grip icon (drag handle) ───────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9"  cy="5"  r="1.5" /><circle cx="15" cy="5"  r="1.5" />
      <circle cx="9"  cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9"  cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

// ── Mobile sortable widget ────────────────────────────────────────────────
function MobileSortableWidget({ id, editMode }) {
  const widget = WIDGET_REGISTRY[id]
  if (!widget) return null

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode,
  })
  const Component = widget.component

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.35 : 1,
        borderRadius: 14,
        outline:    editMode ? `1.5px dashed ${T.ink4}` : 'none',
        outlineOffset: 2,
        position:   'relative',
      }}
    >
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position:       'absolute',
            top:            10,
            right:          10,
            zIndex:         20,
            cursor:         'grab',
            padding:        6,
            borderRadius:   8,
            background:     'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(4px)',
            boxShadow:      '0 1px 4px rgba(0,0,0,0.12)',
            color:          T.ink3,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}
        >
          <GripIcon />
        </div>
      )}
      {/* Disable inner interactions during drag-to-reorder edit mode */}
      <div style={{ pointerEvents: editMode ? 'none' : 'auto' }}>
        <Component />
      </div>
    </div>
  )
}

// ── Mobile DnD widget list ────────────────────────────────────────────────
function MobileDraggableWidgetGrid({ widgetIds, onReorder, editMode }) {
  const [ids, setIds]         = useState(widgetIds)
  const [activeId, setActiveId] = useState(null)
  const prevIds               = useRef(widgetIds)

  if (prevIds.current !== widgetIds) {
    prevIds.current = widgetIds
    setIds(widgetIds)
  }

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
      onReorder(next)
      return next
    })
  }

  const ActiveComponent = activeId ? WIDGET_REGISTRY[activeId]?.component : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ids.map(id => (
            <MobileSortableWidget key={id} id={id} editMode={editMode} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {ActiveComponent && (
          <div style={{ borderRadius: 14, boxShadow: '0 24px 48px rgba(9,18,13,0.25)', transform: 'scale(1.02)', opacity: 0.95, cursor: 'grabbing' }}>
            <ActiveComponent />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ── My Clock hero card ────────────────────────────────────────────────────
function MobileClockCard({ staffId }) {
  return (
    <div
      style={{
        background:    T.brand,
        borderRadius:  14,
        padding:       '16px 18px 18px',
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
      }}
    >
      <span
        className="font-mono"
        style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}
      >
        My Clock
      </span>
      <ClockPanel staffId={staffId} hasShift compact />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────
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
  const now       = useLiveTime()
  const [editMode, setEditMode]             = useState(false)
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

  // Build stat tiles + action list from todayItemIds
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
    ? `${summary.checksToday} of ${summary.totalChecks} daily checks complete`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <PushBanner staffId={session?.staffId} venueId={venueId} />

      {/* Greeting ──────────────────────────────────────────────────────── */}
      <div style={{ ...card(), padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              className="font-mono"
              style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink3 }}
            >
              {format(now, 'EEEE, d MMMM')} · {format(now, 'HH:mm')}
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em', color: T.ink, lineHeight: 1.15, margin: '5px 0 7px' }}>
              {greeting}{firstName ? `, ${firstName}` : ''}.
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              {venueName && (
                <span style={{ fontSize: 13.5, fontWeight: 500, color: T.ink2 }}>{venueName}</span>
              )}
              <MobilePlanPill plan={venuePlan} />
            </div>
            {checksText && (
              <p className="font-mono" style={{ fontSize: 11, color: T.ink3, marginTop: 5 }}>
                {checksText}
              </p>
            )}
          </div>
          <button
            onClick={() => setEditMode(v => !v)}
            style={{
              flexShrink:    0,
              fontSize:      12,
              fontWeight:    600,
              letterSpacing: '0.04em',
              color:         editMode ? T.good : T.ink3,
              background:    editMode ? `${T.good}12` : 'transparent',
              border:        `1px solid ${editMode ? T.good + '40' : T.line}`,
              borderRadius:  8,
              padding:       '5px 12px',
              cursor:        'pointer',
              marginTop:     2,
              whiteSpace:    'nowrap',
              transition:    'all 0.15s',
            }}
          >
            {editMode ? 'Done' : 'Rearrange'}
          </button>
        </div>
      </div>

      <GettingStartedCard venueId={venueId} venueSlug={venueSlug} />

      {/* My Clock ──────────────────────────────────────────────────────── */}
      <MobileClockCard staffId={session?.staffId} />

      {/* Today stat tiles ──────────────────────────────────────────────── */}
      <div style={{ ...card({ overflow: 'hidden' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
          <span
            className="font-mono"
            style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink3, fontWeight: 600 }}
          >
            Today
          </span>
          <button
            onClick={onOpenPicker}
            style={{ fontSize: 11.5, fontWeight: 600, color: T.brand, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Customise
          </button>
        </div>
        <div style={{ padding: '0 12px 12px' }}>
          {!summary ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  style={{ height: 88, borderRadius: 14, background: T.line2 }}
                  className="animate-pulse"
                />
              ))}
            </div>
          ) : activeItems.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${T.line}`,
                borderRadius: 14,
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 13, color: T.ink3 }}>No Today items selected</p>
              <button
                onClick={onOpenPicker}
                style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: T.brand, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                + Add items
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {activeItems.map(item => (
                <MobileStatTile key={item.id} item={item} summary={summary} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pinned alerts — outside SortableContext, non-reorderable ─────── */}
      <DisciplinaryStrip alerts={disciplinaryAlerts} editMode={editMode} venueSlug={venueSlug} />
      <NeedsYouSection actions={actions} editMode={editMode} />

      {/* Edit-mode hint */}
      {editMode && (
        <p
          className="font-mono text-center"
          style={{ fontSize: 10.5, color: T.ink4, letterSpacing: '0.04em' }}
        >
          Drag cards to reorder · tap Done when finished
        </p>
      )}

      {/* Reorderable widget area ───────────────────────────────────────── */}
      {widgetIds.length > 0 ? (
        <MobileDraggableWidgetGrid
          widgetIds={widgetIds}
          onReorder={onReorder}
          editMode={editMode}
        />
      ) : (
        <div
          style={{
            ...card(),
            border:      `1.5px dashed ${T.line}`,
            padding:     '40px 16px',
            textAlign:   'center',
          }}
        >
          <p style={{ fontSize: 13, color: T.ink3, marginBottom: 12 }}>No widgets on your dashboard</p>
          <button
            onClick={onOpenPicker}
            style={{
              background:   T.brand,
              color:        '#fff',
              padding:      '8px 20px',
              borderRadius: 10,
              fontSize:     13,
              fontWeight:   600,
              border:       'none',
              cursor:       'pointer',
            }}
          >
            + Add Widgets
          </button>
        </div>
      )}
    </div>
  )
}
