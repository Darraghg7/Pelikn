import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, addDays, startOfWeek, isToday, isBefore, startOfDay } from 'date-fns'
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

/* ── My Upcoming Shifts ─────────────────────────────────────────────────── */
function MyUpcomingShifts({ shifts, hourlyRate, venueSlug }) {
  if (!shifts?.length) {
    return (
      <div className="bg-white rounded-2xl border-charcoal/10 p-5">
        <SectionLabel>My Upcoming Shifts</SectionLabel>
        <p className="text-sm text-charcoal/40 italic">No shifts scheduled this week</p>
        <Link to={`/v/${venueSlug}/rota`} className="text-xs text-brand/60 hover:text-brand transition-colors mt-2 inline-block">
          View full rota &rarr;
        </Link>
      </div>
    )
  }

  // Calculate totals
  let totalMins = 0
  for (const s of shifts) {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60 // overnight shift
    totalMins += mins
  }
  const totalHours = totalMins / 60
  const estimatedPay = hourlyRate > 0 ? totalHours * hourlyRate : null

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="bg-white rounded-2xl border-charcoal/10 p-5">
      <SectionLabel>My Upcoming Shifts</SectionLabel>

      <div className="flex flex-col gap-2 mb-4">
        {shifts.map(s => {
          const date = new Date(s.shift_date + 'T00:00:00')
          const dayName = DAY_NAMES[date.getDay()]
          const dateStr = format(date, 'd MMM')
          const today = isToday(date)
          const past = isBefore(date, startOfDay(new Date())) && !today

          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                today
                  ? 'border-brand/25 bg-brand/5'
                  : past
                    ? 'border-charcoal/6 bg-charcoal/3 opacity-50'
                    : 'border-charcoal/8 hover:bg-charcoal/3'
              }`}
            >
              <div className="w-12 text-center shrink-0">
                <p className={`text-[11px] uppercase tracking-wider font-semibold ${today ? 'text-brand' : 'text-charcoal/40'}`}>{dayName}</p>
                <p className={`text-sm font-medium ${today ? 'text-brand' : 'text-charcoal/70'}`}>{dateStr}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal">
                  {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                </p>
                {s.role_label && (
                  <p className="text-[11px] text-charcoal/40 mt-0.5">{s.role_label}</p>
                )}
              </div>
              {today && (
                <span className="text-[10px] tracking-widest uppercase font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full shrink-0">Today</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary row */}
      <div className="border-t border-charcoal/8 pt-3 flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-[11px] text-charcoal/40 uppercase tracking-wider">Shifts</p>
          <p className="text-sm font-semibold text-charcoal">{shifts.length}</p>
        </div>
        <div>
          <p className="text-[11px] text-charcoal/40 uppercase tracking-wider">Hours</p>
          <p className="text-sm font-semibold text-charcoal">{totalHours.toFixed(1)}h</p>
        </div>
        {estimatedPay !== null && (
          <div>
            <p className="text-[11px] text-charcoal/40 uppercase tracking-wider">Est. Earnings</p>
            <p className="text-sm font-semibold text-success">&pound;{estimatedPay.toFixed(2)}</p>
          </div>
        )}
        <Link to={`/v/${venueSlug}/rota`} className="text-xs text-brand/60 hover:text-brand transition-colors ml-auto">
          Full rota &rarr;
        </Link>
      </div>
    </div>
  )
}

function HoursThisWeekCard({ staffId, weekMins }) {
  const { sessions, loading } = useClockSessions(staffId)
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl border-charcoal/10 p-5">
      <div className="flex items-center justify-between mb-1">
        <SectionLabel>Hours This Week</SectionLabel>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs font-medium text-brand/70 hover:text-brand transition-colors px-2 py-1 rounded-lg hover:bg-brand/8 -mt-1"
        >
          {open ? 'Close' : 'Edit Hours'}
        </button>
      </div>
      <p className="text-2xl font-bold text-charcoal">{formatMinutes(weekMins)}</p>
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
    localStorage.getItem('pelikn_push_dismissed') === 'true'
  )

  if (!supported || permission === 'denied' || subscribed || dismissed) return null

  const dismiss = () => {
    localStorage.setItem('pelikn_push_dismissed', 'true')
    setDismissed(true)
  }

  return (
    <div className="bg-warning/8 border border-warning/25 rounded-2xl p-4 flex items-center gap-4">
      <span className="shrink-0 w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal">Stay in the loop</p>
        <p className="text-xs text-charcoal/50 mt-0.5">
          Get notified about rota changes, shift swaps, and more.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={subscribe} disabled={subscribing}
          className="bg-brand text-cream rounded-lg text-xs font-semibold px-3 py-1.5 hover:bg-brand/90 transition-colors disabled:opacity-40">
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

const QUICK_ACTION_ICONS = {
  'Clock In': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  'Log Fridge Temp': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
  ),
  'Cleaning': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M8.5 8.5A5 5 0 0 0 12 17a5 5 0 0 0 5-5"/><path d="M12 12V3"/><path d="M9 6l3-3 3 3"/></svg>
  ),
  'Checks': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  ),
  'View Rota': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  'Time Off': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
}

function QuickActions({ venueSlug, hasPermission, isEnabled, hasShift }) {
  const actions = [
    hasShift && { label: 'Clock In', link: `/v/${venueSlug}/clock-in` },
    isEnabled('fridge') && hasPermission('log_temps') && { label: 'Log Fridge Temp', link: `/v/${venueSlug}/fridge/log` },
    isEnabled('cleaning') && hasPermission('manage_cleaning') && { label: 'Cleaning', link: `/v/${venueSlug}/cleaning` },
    isEnabled('opening_closing') && hasPermission('manage_opening') && { label: 'Checks', link: `/v/${venueSlug}/opening-closing` },
    isEnabled('rota') && { label: 'View Rota', link: `/v/${venueSlug}/rota` },
    isEnabled('time_off') && { label: 'Time Off', link: `/v/${venueSlug}/time-off` },
  ].filter(Boolean)

  if (actions.length === 0) return null

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {actions.map(a => (
        <Link
          key={a.label}
          to={a.link}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-charcoal/10 hover:border-charcoal/20 transition-colors text-center"
        >
          <span className="w-10 h-10 rounded-full bg-charcoal/6 flex items-center justify-center text-charcoal/50">
            {QUICK_ACTION_ICONS[a.label]}
          </span>
          <span className="text-[11px] text-charcoal/60 font-medium leading-tight">{a.label}</span>
        </Link>
      ))}
    </div>
  )
}

function TodaySummary({ staffId, venueId, venueSlug, hasPermission, isEnabled }) {
  const [tasks, setTasks] = useState({ pending: 0, cleaning: 0, fridges: 0 })
  const [loaded, setLoaded] = useState(false)
  const [closedToday, setClosedToday] = useState(false)

  useEffect(() => {
    if (!staffId || !venueId) return
    let cancelled = false
    const today = format(new Date(), 'yyyy-MM-dd')

    // Check if venue is closed today
    supabase
      .from('venue_closures')
      .select('id, reason')
      .eq('venue_id', venueId)
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return
        if (data?.length) {
          setClosedToday(data[0].reason || true)
          setLoaded(true)
          return
        }
        setClosedToday(false)
        loadTasks()
      })

    function loadTasks() {
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
    } // end loadTasks
    return () => { cancelled = true }
  }, [staffId, venueId, isEnabled, hasPermission])

  if (!loaded) return null

  if (closedToday) {
    return (
      <div className="bg-brand/5 border border-brand/15 rounded-2xl px-5 py-5 text-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand/50 mx-auto mb-2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
        <p className="text-base font-bold text-charcoal">Venue closed today</p>
        <p className="text-sm text-charcoal/45 mt-1">
          {typeof closedToday === 'string' ? closedToday : 'Enjoy the break!'}
        </p>
      </div>
    )
  }

  const items = [
    tasks.cleaning > 0 && { label: `${tasks.cleaning} cleaning task${tasks.cleaning !== 1 ? 's' : ''} due`, link: `/v/${venueSlug}/cleaning`, color: 'text-warning' },
    tasks.fridges > 0 && { label: `${tasks.fridges} fridge${tasks.fridges !== 1 ? 's' : ''} unchecked`, link: `/v/${venueSlug}/fridge/log`, color: 'text-warning' },
  ].filter(Boolean)

  if (items.length === 0) {
    return (
      <div className="bg-success/5 border border-success/15 rounded-2xl px-4 py-3 flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <p className="text-sm text-success font-medium">All caught up today</p>
      </div>
    )
  }

  return (
    <div className="bg-warning/8 border border-warning/25 rounded-2xl p-4">
      <p className="text-[11px] tracking-widest uppercase text-warning/70 mb-2">Today</p>
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
  const [weekShifts, setWeekShifts] = useState([])
  const [hourlyRate, setHourlyRate] = useState(0)
  const [weekMins, setWeekMins]     = useState(0)
  const [loading, setLoading]       = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!session?.staffId || !venueId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
      const weekStart = format(monday, 'yyyy-MM-dd')
      const weekEnd = format(addDays(monday, 6), 'yyyy-MM-dd')
      try {
        const [shiftRes, allShiftsRes, weekRes, staffRes] = await Promise.all([
          supabase.from('shifts').select('id, start_time, end_time, role_label, shift_date')
            .eq('venue_id', venueId).eq('staff_id', session.staffId).eq('shift_date', today)
            .order('start_time').limit(1),
          supabase.from('shifts').select('id, start_time, end_time, role_label, shift_date')
            .eq('venue_id', venueId).eq('staff_id', session.staffId)
            .gte('shift_date', weekStart).lte('shift_date', weekEnd)
            .order('shift_date').order('start_time'),
          supabase.from('clock_events').select('id, event_type, occurred_at')
            .eq('venue_id', venueId).eq('staff_id', session.staffId).gte('occurred_at', weekStart),
          supabase.from('staff').select('hourly_rate')
            .eq('id', session.staffId).single(),
        ])
        if (cancelled) return
        setTodayShift(shiftRes.data?.[0] ?? null)
        setWeekShifts(allShiftsRes.data ?? [])
        setHourlyRate(staffRes.data?.hourly_rate ?? 0)
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
      <div>
        {venueName && (
          <p className="text-[11px] uppercase tracking-widest text-charcoal/40 font-semibold">{venueName}</p>
        )}
        <p className="text-[11px] text-charcoal/35 mt-0.5">{format(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="text-3xl font-bold text-charcoal mt-1">Good {greeting}, {firstName}</h1>
      </div>

      {/* Push notification prompt — shown prominently until enabled or dismissed */}
      <PushNotificationBanner staffId={session.staffId} venueId={venueId} />

      {/* Quick actions */}
      <QuickActions venueSlug={venueSlug} hasPermission={hasPermission} isEnabled={isEnabled} hasShift={!!todayShift} />

      {/* Today summary */}
      <TodaySummary staffId={session.staffId} venueId={venueId} venueSlug={venueSlug} hasPermission={hasPermission} isEnabled={isEnabled} />

      {/* Desktop: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left: today's shift + clock + upcoming shifts */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-4">
            <SectionLabel>Today's Shift</SectionLabel>
            {todayShift ? (
              <div>
                <p className="text-xl font-bold text-charcoal">{todayShift.start_time.slice(0,5)}–{todayShift.end_time.slice(0,5)}</p>
                <p className="text-sm text-charcoal/50 mt-0.5">{todayShift.role_label}</p>
              </div>
            ) : (
              <p className="text-sm text-charcoal/40 italic">No shift scheduled today</p>
            )}
            <div className="border-t border-charcoal/8 pt-4">
              <ClockPanel staffId={session.staffId} hasShift={!!todayShift} />
            </div>
          </div>

          <MyUpcomingShifts shifts={weekShifts} hourlyRate={hourlyRate} venueSlug={venueSlug} />
        </div>

        {/* Right: hours + recent shifts */}
        <div className="flex flex-col gap-6">
          <HoursThisWeekCard staffId={session.staffId} weekMins={weekMins} />
          <RecentShifts staffId={session.staffId} isManagerEdit={false} />
        </div>

      </div>
    </div>
  )
}
