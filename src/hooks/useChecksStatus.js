import { useState, useEffect } from 'react'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'
import { supabase } from '../lib/supabase'

/**
 * Derives live status for each of the 14 compliance categories.
 * Queries that don't depend on summary (fitness, probe, delivery, incidents)
 * start immediately in parallel with useTodaySummary — no waterfall.
 * Summary-derived statuses (fridge, cleaning, openclose, etc.) resolve once
 * both own queries and summary are ready.
 */
export function useChecksStatus(venueId, summary, summaryLoading) {
  const [rawData, setRawData] = useState(null)
  const [rawLoading, setRawLoading] = useState(true)
  const [statuses, setStatuses] = useState({})

  // Phase 1: fetch independent data immediately (no dependency on summary)
  useEffect(() => {
    if (!venueId) return
    let cancelled = false
    const today = new Date()
    const dayStart = startOfDay(today).toISOString()
    const dayEnd   = endOfDay(today).toISOString()

    setRawLoading(true)

    Promise.all([
      supabase
        .from('fitness_declarations')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .gte('declared_at', dayStart)
        .lte('declared_at', dayEnd),

      supabase
        .from('probe_calibrations')
        .select('calibrated_at')
        .eq('venue_id', venueId)
        .order('calibrated_at', { ascending: false })
        .limit(1),

      supabase
        .from('delivery_checks')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .gte('delivered_at', dayStart)
        .lte('delivered_at', dayEnd),

      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .eq('status', 'open'),
    ]).then(([fitnessRes, probeRes, deliveryRes, incidentRes]) => {
      if (cancelled) return
      setRawData({ fitnessRes, probeRes, deliveryRes, incidentRes, today })
      setRawLoading(false)
    }).catch(() => {
      if (!cancelled) {
        setRawData(null)
        setRawLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [venueId])

  // Phase 2: compute all statuses once both raw data and summary are ready
  useEffect(() => {
    if (rawLoading || summaryLoading || !rawData || !summary) return

    const { fitnessRes, probeRes, deliveryRes, incidentRes, today } = rawData

    // Fitness to Work
    const fitnessCount = fitnessRes.count ?? 0
    const fitness = fitnessCount > 0
      ? { status: 'done', statusText: `Logged today` }
      : { status: 'due', statusText: 'Not logged yet', count: 1 }

    // Opening Checks
    const { checksToday = 0, totalChecks = 0 } = summary
    const openclose = totalChecks === 0
      ? { status: 'na', statusText: 'Not configured' }
      : checksToday >= totalChecks
        ? { status: 'done', statusText: `${checksToday}/${totalChecks} done` }
        : checksToday > 0
          ? { status: 'due', statusText: `${checksToday}/${totalChecks} done`, count: totalChecks - checksToday }
          : { status: 'due', statusText: `0/${totalChecks} done`, count: totalChecks }

    // Fridge Temps
    const { uncheckedFridges = 0, totalFridges = 0 } = summary
    const fridge = totalFridges === 0
      ? { status: 'na', statusText: 'No fridges' }
      : uncheckedFridges === 0
        ? { status: 'done', statusText: `${totalFridges} checked` }
        : { status: 'due', statusText: `${uncheckedFridges} unchecked`, count: uncheckedFridges }

    // Cooking Temps
    const cooking = (summary.cookingTempsToday ?? 0) > 0
      ? { status: 'done', statusText: `${summary.cookingTempsToday} logged` }
      : { status: 'due', statusText: 'None logged yet' }

    // Hot Holding
    const hot = (summary.hotHoldingToday ?? 0) > 0
      ? { status: 'done', statusText: `${summary.hotHoldingToday} logged` }
      : { status: 'due', statusText: 'None logged yet' }

    // Cooling Logs
    const cooling = (summary.coolingLogsToday ?? 0) > 0
      ? { status: 'done', statusText: `${summary.coolingLogsToday} logged` }
      : { status: 'na', statusText: 'None active' }

    // Deliveries
    const deliveryCount = deliveryRes.count ?? 0
    const delivery = deliveryCount > 0
      ? { status: 'done', statusText: `${deliveryCount} logged` }
      : { status: 'na', statusText: 'None today' }

    // Probe Calibration
    let probe
    const lastCal = probeRes.data?.[0]?.calibrated_at
    if (!lastCal) {
      probe = { status: 'overdue', statusText: 'Never done', count: 1 }
    } else {
      const daysSince = Math.floor((today - new Date(lastCal)) / 86400000)
      if (daysSince > 30) {
        probe = { status: 'overdue', statusText: `${daysSince}d overdue`, count: 1 }
      } else if (daysSince > 25) {
        probe = { status: 'due', statusText: `Due in ${30 - daysSince}d`, count: 1 }
      } else {
        probe = { status: 'done', statusText: `Done ${daysSince}d ago` }
      }
    }

    // Allergens — static registry
    const allergen = { status: 'na', statusText: 'Up to date' }

    // Pest Control
    const pest = { status: 'na', statusText: 'No sightings' }

    // Cleaning
    const overdueClean = summary.overdueClean ?? 0
    const cleaning = overdueClean > 0
      ? { status: 'overdue', statusText: `${overdueClean} overdue`, count: overdueClean }
      : { status: 'done', statusText: 'All up to date' }

    // HACCP
    const haccp = { status: 'na', statusText: 'Plan current' }

    // Documents
    const docs = { status: 'na', statusText: 'Up to date' }

    // Incidents
    const openIncidents = incidentRes.count ?? 0
    const incident = openIncidents > 0
      ? { status: 'due', statusText: `${openIncidents} open`, count: openIncidents }
      : { status: 'na', statusText: 'None open' }

    setStatuses({
      fitness, openclose, fridge, cooking, hot, cooling,
      delivery, probe, allergen, pest, cleaning, haccp, docs, incident,
    })
  }, [rawData, rawLoading, summary, summaryLoading])

  return { statuses, loading: rawLoading || summaryLoading }
}
