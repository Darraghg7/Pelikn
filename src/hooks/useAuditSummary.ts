import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { useVenue } from '../contexts/VenueContext'
import { fetchAuditData, type AuditRawData } from '../lib/api/audit'
import { documentStatus } from './useDocuments'
import { readingOutOfRange } from '../lib/utils'

const EXPLAINED = ['delivery', 'defrost', 'service_access']

function deriveAuditStats(raw: AuditRawData, sinceTs: string) {
  const { temps, cleaningTasks, cleaningCompletions, deliveries, calibrations, actions, certs, activeStaff } = raw

  // ── Temp analysis ──────────────────────────────────────────────────
  const tempTotal = temps.length
  // Against the range the fridge had when the reading was taken (163), so
  // widening a range later can't turn past failures into passes.
  const failedTemps = temps.filter((t: any) =>
    t.fridge &&
    readingOutOfRange(t, t.fridge) &&
    !EXPLAINED.includes(t.exceedance_reason) &&
    !t.is_resolved
  )
  const tempFails = failedTemps.length
  const tempPassRate = tempTotal > 0 ? Math.round(((tempTotal - tempFails) / tempTotal) * 100) : 100

  // ── Delivery analysis ─────────────────────────────────────────────
  const deliveryTotal = deliveries.length
  const failedDeliveries = deliveries.filter((d: any) => !d.overall_pass && !d.is_resolved)
  const deliveryFails = failedDeliveries.length

  // ── Probe analysis ────────────────────────────────────────────────
  const probeTotal = calibrations.length
  const failedProbes = calibrations.filter((p: any) => !p.pass && !p.is_resolved)
  const probeFails = failedProbes.length
  const lastProbe = calibrations.length > 0 ? calibrations[0].calibrated_at : null

  // ── Corrective actions ────────────────────────────────────────────
  const openActions = actions.filter((a: any) => a.status === 'open')
  const caOpen = openActions.length
  const caCritical = openActions.filter((a: any) => a.severity === 'critical').length

  // ── Training ──────────────────────────────────────────────────────
  // A certificate is valid for the whole of its expiry date (calendar days, as
  // the Documents page counts them). It stays expired until its expiry date is
  // actually updated: it used to disappear from this list when someone tapped
  // "Renewed", leaving the screen saying all was well while the EHO PDF still
  // listed it as expired.
  const expiredCertsList = certs.filter((c: any) => documentStatus(c).status === 'expired')
  const expiredCerts = expiredCertsList.length
  const validCerts = certs.filter((c: any) => documentStatus(c).status !== 'expired').length

  return {
    tempTotal, tempFails, tempPassRate, failedTemps: failedTemps.slice(0, 15),
    cleaningTotal: cleaningCompletions.length, cleaningTaskCount: cleaningTasks.length,
    deliveryTotal, deliveryFails, failedDeliveries: failedDeliveries.slice(0, 10),
    probeTotal, probeFails, lastProbe, failedProbes: failedProbes.slice(0, 10),
    caOpen, caCritical,
    // Logged in the window — the query also returns older rows that are still open
    caTotal: actions.filter((a: any) => new Date(a.reported_at) >= new Date(sinceTs)).length, openActions: openActions.slice(0, 10),
    expiredCerts, validCerts, totalCerts: certs.length, expiredCertsList: expiredCertsList.slice(0, 10),
    staffCount: activeStaff.length,
  }
}

/**
 * EHO audit trail summary — one cached query (60s) instead of 8 raw
 * supabase calls firing fresh on every visit to /audit.
 */
export function useAuditSummary(range: number) {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const sinceTs = useMemo(() => subDays(new Date(), range).toISOString(), [range])
  const queryKey = ['audit-summary', venueId, range]

  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchAuditData(venueId!, sinceTs),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  const data = useMemo(() => (raw ? deriveAuditStats(raw, sinceTs) : null), [raw, sinceTs])

  /**
   * Patch a record's resolution fields in the cache in place, without a full
   * refetch. Deliberately does NOT remove the row from the underlying array —
   * tempTotal/deliveryTotal/probeTotal/totalCerts/caTotal are all `array.length`,
   * so removing a resolved row would wrongly shrink "total readings" the moment
   * you resolve one, even though the reading still happened. Only the derived
   * failed/open lists (which filter on is_resolved/status) should shrink.
   */
  const markResolvedInCache = (listKey: keyof AuditRawData, id: string, patch: Record<string, unknown>) => {
    queryClient.setQueryData<AuditRawData | undefined>(queryKey, (prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [listKey]: (prev[listKey] as any[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }
    })
  }

  // `failed` is only true when there is nothing to show: a background refresh
  // that fails keeps the last good summary on screen.
  return { data, loading: isLoading, failed: isError && !raw, retry: refetch, queryKey, markResolvedInCache }
}
