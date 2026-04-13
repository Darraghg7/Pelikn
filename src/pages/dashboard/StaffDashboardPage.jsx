import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueBranding } from '../../hooks/useVenueBranding'
import { useSession } from '../../contexts/SessionContext'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { formatMinutes } from '../../lib/utils'
import ClockPanel from '../../components/shifts/ClockPanel'
import RecentShifts from '../../components/shifts/RecentShifts'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useClockSessions } from '../../hooks/useClockSessions'
import { usePushNotifications } from '../../hooks/usePushNotifications'


function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function HoursThisWeekCard({ staffId, weekMins }) {
  const { sessions, loading } = useClockSessions(staffId)
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-charcoal/10 p-5">
      <div className="flex items-center justify-between mb-1">
        <SectionLabel>Hours This Week</SectionLabel>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs font-medium text-brand/70 hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/8 -mt-1"
        >
          {open ? 'Close' : 'Edit Hours'}
        </button>
      </div>
      <p className="font-serif text-3xl text-charcoal">{formatMinutes(weekMins)}</p>
      <p className="text-xs text-charcoal/40 mt-1">
        {weekMins > 0 ? `${(weekMins / 60).toFixed(1)} hours logged` : 'No hours logged yet this week'}
      </p>

      {open && !loading && (
        <div className="mt-4 pt-4 border-t border-charcoal/8">
          <RecentShifts staffId={staffId} isManagerEdit={false} inline />
        </div>
      )}
    </div>
  )
}

function PushNotificationBanner({ staffId, venueId }) {
  const { supported, permission, subscribed, subscribing, subscribe } =
    usePushNotifications(staffId, venueId)
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('safeserv_push_dismissed') === 'true'
  )

  if (!supported || permission === 'denied' || subscribed || dismissed) return null

  const dismiss = () => {
    localStorage.setItem('safeserv_push_dismissed', 'true')
    setDismissed(true)
  }

  return (
    <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-center gap-4">
      <span className="text-2xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal">Stay in the loop</p>
        <p className="text-xs text-charcoal/50 mt-0.5">
          Get notified about rota changes, shift swaps, time-off decisions, and more.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={subscribe} disabled={subscribing}
          className="bg-brand text-cream px-4 py-2 rounded-xl text-xs font-medium hover:bg-brand/90 transition-colors disabled:opacity-40">
          {subscribing ? 'Enabling…' : 'Enable'}
        </button>
        <button onClick={dismiss}
          className="text-charcoal/30 hover:text-charcoal/60 transition-colors p-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  )
}

function QuickActions({ venueSlug, hasPermission, isEnabled, hasShift }) {
  const actions = [
    hasShift && { icon: '\u23F1', label: 'Clock In', link: `/v/${venueSlug}/clock-in` },
    isEnabled('fridge') && hasPermission('log_temps') && { icon: '\uD83C\uDF21\uFE0F', label: 'Log Fridge Temp', link: `/v/${venueSlug}/fridge/log` },
    isEnabled('cleaning') && hasPermission('manage_cleaning') && { icon: '\uD83E\uDDF9', label: 'Cleaning', link: `/v/${venueSlug}/cleaning` },
    isEnabled('opening_closing') && hasPermission('manage_opening') && { icon: '\u2611\uFE0F', label: 'Checks', link: `/v/${venueSlug}/opening-closing` },
    isEnabled('rota') && { icon: '\uD83D\uDCC5', label: 'View Rota', link: `/v/${venueSlug}/rota` },
    isEnabled('time_off') && { icon: '\uD83C\uDFD6\uFE0F', label: 'Time Off', link: `/v/${venueSlug}/time-off` },
  ].filter(Boolean)

  if (actions.length === 0) return null

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {actions.map(a => (
        <Link
          key={a.label}
          to={a.link}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-charcoal/10 hover:border-charcoal/20 transition-colors text-center"
        >
          <span className="text-xl">{a.icon}</span>
          <span className="text-[11px] text-charcoal/60 font-medium leading-tight">{a.label}</span>
        </Link>
      ))}
    </div>
  )
}

function TodaySummary({ staffId, venueId, venueSlug, hasPermission, isEnabled }) {
  const [tasks, setTasks] = useState({ pending: 0, cleaning: 0, fridges: 0 })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!staffId || !venueId) return
    let cancelled = false
    const today = format(new Date(), 'yyyy-MM-dd')

    const promises = []

    // Pending tasks assigned to this staff
    promises.push(
      supabase.from('task_completions')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .eq('staff_id', staffId)
        .eq('completion_date', today)
        .then(({ count }) => ({ type: 'done_tasks', count: count ?? 0 }))
    )

    // Overdue cleaning (unfinished tasks for today)
    if (isEnabled('cleaning') && hasPermission('manage_cleaning')) {
      promises.push(
        supabase.from('cleaning_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .then(({ count }) => ({ type: 'total_cleaning', count: count ?? 0 }))
      )
      promises.push(
        supabase.from('cleaning_completions')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
          .gte('completed_at', today + 'T00:00:00')
          .then(({ count }) => ({ type: 'done_cleaning', count: count ?? 0 }))
      )
    }

    // Fridge checks not yet done
    if (isEnabled('fridge') && hasPermission('log_temps')) {
      promises.push(
        supabase.from('fridges')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .then(({ count }) => ({ type: 'total_fridges', count: count ?? 0 }))
      )
      promises.push(
        supabase.from('fridge_temperature_logs')
          .select('fridge_id')
          .eq('venue_id', venueId)
          .gte('logged_at', today + 'T00:00:00')
          .then(({ data }) => ({ type: 'checked_fridges', count: new Set((data ?? []).map(r => r.fridge_id)).size }))
      )
    }

    Promise.all(promises).then(results => {
      if (cancelled) return
      const r = {}
      for (const res of results) r[res.type] = res.count
      setTasks({
        pending: 0,
        cleaning: Math.max(0, (r.total_cleaning ?? 0) - (r.done_cleaning ?? 0)),
        fridges: Math.max(0, (r.total_fridges ?? 0) - (r.checked_fridges ?? 0)),
      })
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [staffId, venueId, isEnabled, hasPermission])

  if (!loaded) return null

  const items = [
    tasks.cleaning > 0 && { label: `${tasks.cleaning} cleaning task${tasks.cleaning !== 1 ? 's' : ''} due`, link: `/v/${venueSlug}/cleaning`, color: 'text-amber-600' },
    tasks.fridges > 0 && { label: `${tasks.fridges} fridge${tasks.fridges !== 1 ? 's' : ''} unchecked`, link: `/v/${venueSlug}/fridge/log`, color: 'text-amber-600' },
  ].filter(Boolean)

  if (items.length === 0) {
    return (
      <div className="bg-success/5 border border-success/15 rounded-xl px-4 py-3">
        <p className="text-sm text-success font-medium">All caught up today</p>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-4">
      <p className="text-[11px] tracking-widest uppercase text-amber-700/60 mb-2">Today</p>
      <div className="flex flex-col gap-1.5">
        {items.map(item => (
          <Link key={item.label} to={item.link} className={`text-sm font-medium ${item.color} hover:underline`}>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function StaffDashboardPage() {
  const { venueId, venueSlug } = useVenue()
  const { session, hasPermission } = useSession()
  const { isEnabled } = useVenueFeatures()
  const { venueName, logoUrl } = useVenueBranding(venueId)
  const [todayShift, setTodayShift] = useState(null)
  const [weekMins, setWeekMins]     = useState(0)
  const [loading, setLoading]       = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!session?.staffId || !venueId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const weekStart = format(
        new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)),
        'yyyy-MM-dd'
      )
      try {
        const [shiftRes, weekRes] = await Promise.all([
          supabase.from('shifts').select('id, start_time, end_time, role_label, shift_date')
            .eq('venue_id', venueId).eq('staff_id', session.staffId).eq('shift_date', today)
            .order('start_time').limit(1),
          supabase.from('clock_events').select('id, event_type, occurred_at')
            .eq('venue_id', venueId).eq('staff_id', session.staffId).gte('occurred_at', weekStart),
        ])
        if (cancelled) return
        setTodayShift(shiftRes.data?.[0] ?? null)
        const events = [...(weekRes.data ?? [])].sort(
          (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
        )
        let mins = 0, lastIn = null
        for (const e of events) {
          if (e.event_type === 'clock_in') lastIn = new Date(e.occurred_at)
          if (e.event_type === 'clock_out' && lastIn) {
            mins += (new Date(e.occurred_at) - lastIn) / 60000
            lastIn = null
          }
        }
        // Count time for an active (unclosed) session up to now
        if (lastIn) mins += (Date.now() - lastIn) / 60000
        setWeekMins(Math.round(mins))
      } catch { /* network error — leave defaults */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [session?.staffId, today, venueId])

  if (!session) return null
  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'
  const firstName = session.staffName?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Venue logo"
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-contain bg-white border border-charcoal/10 p-1 shrink-0"
          />
        )}
        <div>
          {venueName && (
            <p className="font-serif text-2xl sm:text-3xl text-charcoal font-semibold">{venueName}</p>
          )}
          <p className="text-xs uppercase tracking-widest text-charcoal/40 mt-0.5">{format(new Date(), 'EEEE, d MMMM')}</p>
          <h1 className="font-serif text-xl text-brand/70 mt-0.5">Good {greeting}, {firstName}</h1>
        </div>
      </div>

      {/* Push notification prompt — shown prominently until enabled or dismissed */}
      <PushNotificationBanner staffId={session.staffId} venueId={venueId} />

      {/* Quick actions */}
      <QuickActions venueSlug={venueSlug} hasPermission={hasPermission} isEnabled={isEnabled} hasShift={!!todayShift} />

      {/* Today summary */}
      <TodaySummary staffId={session.staffId} venueId={venueId} venueSlug={venueSlug} hasPermission={hasPermission} isEnabled={isEnabled} />

      {/* Desktop: two columns — shift/clock left, recent shifts right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left: today's shift + clock + hours */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-4">
            <SectionLabel>Today's Shift</SectionLabel>
            {todayShift ? (
              <div>
                <p className="font-serif text-2xl text-charcoal">{todayShift.start_time.slice(0,5)}–{todayShift.end_time.slice(0,5)}</p>
                <p className="text-sm text-charcoal/50 mt-0.5">{todayShift.role_label}</p>
              </div>
            ) : (
              <p className="text-sm text-charcoal/40 italic">No shift scheduled today</p>
            )}
            <div className="border-t border-charcoal/8 pt-4">
              <ClockPanel staffId={session.staffId} hasShift={!!todayShift} />
            </div>
            <Link to={`/v/${venueSlug}/rota`} className="text-center text-xs text-charcoal/40 hover:text-charcoal transition-colors">View Rota →</Link>
          </div>

          <HoursThisWeekCard staffId={session.staffId} weekMins={weekMins} />
        </div>

        {/* Right: recent shifts with editing */}
        <RecentShifts staffId={session.staffId} isManagerEdit={false} />

      </div>
    </div>
  )
}
