import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addDays } from 'date-fns'

function venueStatus(d) {
  if (!d) return 'gray'
  if (!d.fridgeAM || !d.fridgePM || !d.hotHoldingAM || !d.hotHoldingPM) return 'red'
  if (d.pendingTimeOff.length > 0) return 'amber'
  return 'green'
}

async function fetchVenueData(venueId) {
  const today    = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const [
    { data: fridgeLogs },
    { data: cookingLogs },
    { data: hotLogs },
    { data: timeOffRows },
    { data: clockEvents },
  ] = await Promise.all([
    supabase.from('fridge_temperature_logs').select('check_period').eq('venue_id', venueId).gte('logged_at', today).lt('logged_at', tomorrow),
    supabase.from('cooking_temp_logs').select('id').eq('venue_id', venueId).gte('logged_at', today).lt('logged_at', tomorrow),
    supabase.from('hot_holding_logs').select('check_period').eq('venue_id', venueId).gte('logged_at', today).lt('logged_at', tomorrow),
    supabase.from('time_off_requests').select('id, start_date, end_date, reason, staff(name)').eq('venue_id', venueId).eq('status', 'pending'),
    supabase.from('clock_events').select('staff_id, event_type').eq('venue_id', venueId).gte('occurred_at', today).lt('occurred_at', tomorrow).order('occurred_at'),
  ])

  const sessions = {}
  for (const e of clockEvents ?? []) {
    const sid = e.staff_id
    if (!sessions[sid]) sessions[sid] = { status: 'out' }
    if (e.event_type === 'clock_in')    sessions[sid].status = 'in'
    if (e.event_type === 'clock_out')   sessions[sid].status = 'out'
    if (e.event_type === 'break_start') sessions[sid].status = 'break'
    if (e.event_type === 'break_end')   sessions[sid].status = 'in'
  }
  const clockedInCount = Object.values(sessions).filter(s => s.status === 'in' || s.status === 'break').length

  const logs = fridgeLogs ?? []
  const hot  = hotLogs ?? []

  return {
    fridgeAM:       logs.some(l => l.check_period === 'am'),
    fridgePM:       logs.some(l => l.check_period === 'pm'),
    cookingCount:   (cookingLogs ?? []).length,
    hotHoldingAM:   hot.some(l => l.check_period === 'am'),
    hotHoldingPM:   hot.some(l => l.check_period === 'pm'),
    pendingTimeOff: timeOffRows ?? [],
    clockedInCount,
  }
}

/**
 * Fetches compliance data for all venues in parallel.
 * Returns { venues: [{venue, data, status, loading}], aggregate, loading }
 */
export function useAllVenueCompliance(venues) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venues?.length) { setLoading(false); setResults([]); return }
    let cancelled = false
    setLoading(true)

    const init = venues.map(v => ({ venue: v, data: null, status: 'gray', loading: true }))
    setResults(init)

    Promise.allSettled(venues.map(v => fetchVenueData(v.id))).then(settled => {
      if (cancelled) return
      setResults(venues.map((venue, i) => {
        const result = settled[i]
        if (result.status === 'fulfilled') {
          return { venue, data: result.value, status: venueStatus(result.value), loading: false }
        }
        return { venue, data: null, status: 'gray', loading: false }
      }))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [venues?.map(v => v.id).join(',')])

  const aggregate = {
    total:      results.length,
    critical:   results.filter(r => r.status === 'red').length,
    attention:  results.filter(r => r.status === 'amber').length,
    allClear:   results.filter(r => r.status === 'green').length,
    onShift:    results.reduce((sum, r) => sum + (r.data?.clockedInCount ?? 0), 0),
    decisions:  results.reduce((sum, r) => sum + (r.data?.pendingTimeOff?.length ?? 0), 0),
  }

  return { results, aggregate, loading }
}
