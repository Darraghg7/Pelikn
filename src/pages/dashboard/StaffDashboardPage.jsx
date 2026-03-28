import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { formatMinutes } from '../../lib/utils'
import ClockPanel from '../../components/ClockPanel'
import RecentShifts from '../../components/shifts/RecentShifts'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function useVenueBranding(venueId) {
  const [venueName, setVenueName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  useEffect(() => {
    if (!venueId) return
    let cancelled = false
    supabase.from('app_settings').select('key, value')
      .eq('venue_id', venueId)
      .in('key', ['venue_name', 'logo_url'])
      .then(({ data }) => {
        if (cancelled || !data) return
        const map = Object.fromEntries(data.map(r => [r.key, r.value]))
        setVenueName(map.venue_name ?? '')
        setLogoUrl(map.logo_url ?? '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [venueId])
  return { venueName, logoUrl }
}

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

export default function StaffDashboardPage() {
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
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
          supabase.from('shifts').select('*')
            .eq('venue_id', venueId).eq('staff_id', session.staffId).eq('shift_date', today)
            .order('start_time').limit(1),
          supabase.from('clock_events').select('*')
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

          <div className="bg-white rounded-xl border border-charcoal/10 p-5">
            <SectionLabel>Hours This Week</SectionLabel>
            <p className="font-serif text-3xl text-charcoal">{formatMinutes(weekMins)}</p>
            <p className="text-xs text-charcoal/40 mt-1">{weekMins > 0 ? `${(weekMins/60).toFixed(1)} hours logged` : 'No hours logged yet this week'}</p>
          </div>
        </div>

        {/* Right: recent shifts with editing */}
        <RecentShifts staffId={session.staffId} isManagerEdit={false} />

      </div>
    </div>
  )
}
