import React, { useState } from 'react'
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
import TodaySummaryCard from './TodaySummaryCard'
import WidgetPicker from './WidgetPicker'
import PushBanner from './PushBanner'
import GettingStartedCard from './GettingStartedCard'

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

export default function ManagerDashboardPage() {
  const { venueId, venuePlan, venueSlug } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const { venueName } = useVenueBranding(venueId)
  const { widgetIds, save } = useWidgetPreferences(session?.staffId, venueId)
  const { todayItemIds, save: saveToday } = useTodayPreferences(session?.staffId, venueId)
  const { closedDays, actionSchedules } = useAppSettings()
  const [showPicker, setShowPicker] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = session?.staffName?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
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

      <PushBanner staffId={session?.staffId} venueId={venueId} />
      <GettingStartedCard venueId={venueId} venueSlug={venueSlug} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <TodaySummaryCard venueId={venueId} closedDays={closedDays} itemIds={todayItemIds} actionSchedules={actionSchedules} />
        <div className="bg-white rounded-2xl p-5">
          <p className="text-[11px] tracking-widest uppercase font-semibold text-charcoal/40 mb-3">My Clock</p>
          <ClockPanel staffId={session?.staffId} hasShift />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgetIds.map(id => {
          const widget = WIDGET_REGISTRY[id]
          if (!widget) return null
          const Component = widget.component
          return <Component key={id} />
        })}
      </div>

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
