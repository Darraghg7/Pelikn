import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { WIDGET_REGISTRY } from '../../components/widgets/WidgetRegistry'
import ClockPanel from '../../components/shifts/ClockPanel'
import { useVenueBranding } from '../../hooks/useVenueBranding'
import { useAppSettings } from '../../hooks/useSettings'
import { useWidgetPreferences } from '../../hooks/useWidgetPreferences'
import { useTodayPreferences } from '../../hooks/useTodayPreferences'
import { useTodaySummary } from '../../hooks/useTodaySummary'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import TodaySummaryCard from './TodaySummaryCard'
import WidgetPicker from './WidgetPicker'
import PushBanner from './PushBanner'
import GettingStartedCard from './GettingStartedCard'
import MobileManagerDashboard from './MobileManagerDashboard'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  KeyboardSensor,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy,
  useSortable, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PLAN_CONFIG = {
  starter: { label: 'Starter', bg: 'bg-success/8',   text: 'text-brand', border: 'border-success/30'  },
  pro:     { label: 'Pro',     bg: 'bg-accent/10', text: 'text-accent',   border: 'border-accent/25' },
}

function PlanBadge({ plan }) {
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.starter
  return (
    <span className={`text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

function UpgradeButton() {
  return (
    <a
      href="mailto:hello@pelikn.app?subject=Upgrade to Pro"
      className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/30 transition-all hover:shadow-lg hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: 'linear-gradient(135deg, #c94f2a 0%, #e06535 50%, #c94f2a 100%)',
        backgroundSize: '200% 100%',
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-[shimmer_2.5s_ease-in-out_infinite]"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
        }}
      />
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 relative">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
      <span className="relative">Upgrade to Pro</span>
      <span className="relative font-normal opacity-75">· £25/mo</span>
    </a>
  )
}

/* ── Draggable widget grid ──────────────────────────────────────────────── */
function SortableWidget({ id }) {
  const widget = WIDGET_REGISTRY[id]
  if (!widget) return null
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const Component = widget.component
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className="relative group rounded-2xl"
    >
      {/* Drag handle — top-right, appears on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-white/80 backdrop-blur-sm text-charcoal/40 hover:text-charcoal/70 shadow-sm"
        title="Drag to reorder"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
        </svg>
      </div>
      <Component />
    </div>
  )
}

function DraggableWidgetGrid({ widgetIds, onReorder }) {
  const [ids, setIds] = useState(widgetIds)
  const [activeId, setActiveId] = useState(null)

  // Keep local state in sync when widgetIds prop changes (e.g. after picker save)
  const prevIds = useRef(widgetIds)
  if (prevIds.current !== widgetIds) { prevIds.current = widgetIds; setIds(widgetIds) }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = ({ active }) => setActiveId(active.id)
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    setIds(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id))
      onReorder(next)
      return next
    })
  }

  const ActiveWidget = activeId ? WIDGET_REGISTRY[activeId]?.component : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ids.map(id => <SortableWidget key={id} id={id} />)}
        </div>
      </SortableContext>
      <DragOverlay>
        {ActiveWidget && (
          <div className="rounded-2xl shadow-2xl scale-[1.03] opacity-95 cursor-grabbing">
            <ActiveWidget />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function StatTile({ label, value, variant = 'neutral', to }) {
  const dot = { neutral: 'bg-charcoal/20', good: 'bg-success', warn: 'bg-warning', danger: 'bg-danger' }
  const num = { neutral: 'text-charcoal', good: 'text-charcoal', warn: 'text-warning', danger: 'text-danger' }
  const inner = (
    <div className="flex flex-col gap-2 bg-white rounded-2xl p-4 min-h-[100px]">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[variant]}`} />
        <span className="font-mono text-[10px] text-charcoal/40 uppercase tracking-[0.08em] leading-none">{label}</span>
      </div>
      <div className={`text-[34px] font-medium tracking-[-0.035em] leading-none tabular-nums ${num[variant]}`}>
        {value}
      </div>
    </div>
  )
  return to ? <Link to={to} className="hover:opacity-80 transition-opacity">{inner}</Link> : inner
}

function DesktopStatGrid({ summary, venueSlug, isEnabled }) {
  const vp = (p) => `/v/${venueSlug}${p}`

  if (!summary) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-[100px] rounded-2xl bg-charcoal/5 animate-pulse" />)}
      </div>
    )
  }

  const checks = summary.checksToday
  const totalChecks = summary.totalChecks
  const fridgesDue = summary.uncheckedFridges
  const totalFridges = summary.totalFridges

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile
        label="On Shift"
        value={summary.onShiftToday}
        to={vp('/rota')}
      />
      <StatTile
        label="Checks Done"
        value={totalChecks > 0 ? `${checks}/${totalChecks}` : '—'}
        variant={totalChecks > 0 && checks >= totalChecks ? 'good' : 'neutral'}
        to={isEnabled('opening_closing') ? vp('/opening-closing') : undefined}
      />
      <StatTile
        label="Fridges Due"
        value={totalFridges > 0 ? `${fridgesDue}/${totalFridges}` : '—'}
        variant={fridgesDue > 0 ? 'warn' : totalFridges > 0 ? 'good' : 'neutral'}
        to={isEnabled('fridge_checks') ? vp('/fridge') : undefined}
      />
      <StatTile
        label="Overdue Cleans"
        value={summary.overdueClean}
        variant={summary.overdueClean > 0 ? 'danger' : 'good'}
        to={vp('/cleaning')}
      />
      <StatTile
        label="Critical"
        value={summary.criticalActions}
        variant={summary.criticalActions > 0 ? 'danger' : 'good'}
        to={vp('/corrective-actions')}
      />
      <StatTile
        label="Time Off"
        value={summary.pendingLeave}
        variant={summary.pendingLeave > 0 ? 'warn' : 'neutral'}
        to={vp('/rota')}
      />
    </div>
  )
}

export default function ManagerDashboardPage() {
  const { venueId, venuePlan, venueSlug } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const navigate = useNavigate()

  // Redirect to setup wizard if onboarding not yet complete
  useEffect(() => {
    if (!venueId) return
    supabase
      .from('app_settings')
      .select('value')
      .eq('venue_id', venueId)
      .eq('key', 'onboarding_complete')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) navigate(`/v/${venueSlug}/setup`, { replace: true })
      })
  }, [venueId, venueSlug, navigate])
  const { venueName } = useVenueBranding(venueId)
  const { widgetIds, save } = useWidgetPreferences(session?.staffId, venueId)
  const { todayItemIds, save: saveToday } = useTodayPreferences(session?.staffId, venueId)
  const { closedDays, actionSchedules } = useAppSettings()
  const { isEnabled } = useVenueFeatures()
  const { summary } = useTodaySummary(venueId, closedDays, actionSchedules)
  const [showPicker, setShowPicker] = useState(false)

  const vp = (p) => `/v/${venueSlug}${p}`
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = session?.staffName?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-4">
      {/* Greeting — desktop only; mobile has its own greeting card inside MobileManagerDashboard */}
      <div className="hidden lg:flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-charcoal/40">{format(new Date(), 'EEEE, d MMMM')}</p>
          <h1 className="text-[30px] font-medium tracking-[-0.028em] text-charcoal leading-tight mt-0.5">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          {venueName && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-medium text-charcoal/50">{venueName}</p>
              <PlanBadge plan={venuePlan} />
            </div>
          )}
          {summary && (
            <p className="hidden lg:block text-sm text-charcoal/40 mt-0.5">
              {summary.checksToday} of {summary.totalChecks} daily checks complete
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {venuePlan === 'starter' && <UpgradeButton />}
          <button
            onClick={() => setShowPicker(true)}
            className="text-[11px] font-semibold tracking-wider uppercase text-charcoal/40 hover:text-charcoal/70 border border-charcoal/15 hover:border-charcoal/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            Customise
          </button>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden">
        <MobileManagerDashboard
          session={session}
          venueId={venueId}
          venueName={venueName}
          venuePlan={venuePlan}
          venueSlug={venueSlug}
          greeting={greeting}
          firstName={firstName}
          summary={summary}
          widgetIds={widgetIds}
          onReorder={(newIds) => { save(newIds) }}
          todayItemIds={todayItemIds}
          actionSchedules={actionSchedules}
          onOpenPicker={() => setShowPicker(true)}
          isEnabled={isEnabled}
        />
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        <GettingStartedCard venueId={venueId} venueSlug={venueSlug} />

        {summary?.overdueClean > 0 && (
          <Link
            to={vp('/cleaning')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-danger/8 border border-danger/15 text-danger hover:bg-danger/12 transition-colors"
          >
            <span className="w-5 h-5 rounded-full bg-danger/18 flex items-center justify-center shrink-0">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            <p className="text-sm font-semibold flex-1">
              {summary.overdueClean} overdue {summary.overdueClean === 1 ? 'clean' : 'cleans'}
            </p>
            <span className="font-mono text-xs opacity-60">→</span>
          </Link>
        )}

        <div className="grid grid-cols-[1fr_280px] gap-4 items-start">
          <DesktopStatGrid summary={summary} venueSlug={venueSlug} isEnabled={isEnabled} />
          <div className="bg-white rounded-2xl p-5">
            <p className="text-[11px] tracking-widest uppercase font-semibold text-charcoal/40 mb-3">My Clock</p>
            <ClockPanel staffId={session?.staffId} hasShift />
          </div>
        </div>
      </div>

      {/* Widget grid — desktop only (mobile renders its own inside MobileManagerDashboard) */}
      <div className="hidden lg:block">
        {widgetIds.length > 0 && (
          <DraggableWidgetGrid
            widgetIds={widgetIds}
            onReorder={(newIds) => { save(newIds); toast('Widget order saved') }}
          />
        )}
        {widgetIds.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-charcoal/20 p-10 text-center">
            <p className="text-charcoal/30 text-sm mb-3">No widgets on your dashboard</p>
            <button
              onClick={() => setShowPicker(true)}
              className="bg-charcoal text-cream px-4 py-2 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors"
            >
              + Add Widgets
            </button>
          </div>
        )}
      </div>

      <WidgetPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        activeIds={widgetIds}
        todayIds={todayItemIds}
        onSave={(newIds) => { save(newIds); toast('Dashboard updated') }}
        onSaveToday={saveToday}
      />
    </div>
  )
}
