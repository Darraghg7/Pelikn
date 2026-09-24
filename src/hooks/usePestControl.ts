import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const PEST_LOG_TYPES = [
  { value: 'inspection', label: 'Routine inspection', hint: 'Scheduled walk-round' },
  { value: 'sighting',   label: 'Pest sighting',      hint: 'Activity or evidence' },
  { value: 'treatment',  label: 'Treatment',          hint: 'Baiting, spraying, proofing' },
  { value: 'follow_up',  label: 'Follow-up',          hint: 'Update an open issue' },
]

// Offered as quick picks until the venue has its own most-used locations
export const DEFAULT_PEST_LOCATIONS = ['Dry store', 'Kitchen', 'Back yard', 'Bin area', 'Cellar']

export const PEST_TYPES = [
  { value: 'rodent',     label: 'Rodent' },
  { value: 'cockroach',  label: 'Cockroach' },
  { value: 'fly',        label: 'Fly / Flying insect' },
  { value: 'ant',        label: 'Ant' },
  { value: 'bird',       label: 'Bird' },
  { value: 'other',      label: 'Other' },
]

export const PEST_SEVERITIES = [
  { value: 'low',    label: 'Low',    color: 'text-success' },
  { value: 'medium', label: 'Medium', color: 'text-warning' },
  { value: 'high',   label: 'High',   color: 'text-danger' },
]

export interface PestControlLog {
  id: string
  log_type: string
  pest_type?: string
  severity?: string
  location?: string
  description: string
  action_taken?: string
  contractor?: string
  status: string
  logged_at: string
  logged_by?: string | null
  logged_by_name?: string
  issue_id?: string | null   // set on entries about an existing issue (121)
  venue_id: string
}

export interface PestIssue extends PestControlLog {
  timeline: PestControlLog[]  // later entries linked to this issue, oldest first
}

const LEGACY_PEST_COLUMNS = 'id, log_type, pest_type, severity, location, description, action_taken, contractor, status, logged_at, logged_by, logged_by_name, venue_id'
const PEST_COLUMNS = `${LEGACY_PEST_COLUMNS}, issue_id`

// Before migration 121 there is no issue_id column: retry without it
async function selectWithFallback(build: (columns: string, linked: boolean) => PromiseLike<{ data: unknown; error: unknown }>): Promise<PestControlLog[]> {
  const { data, error } = await build(PEST_COLUMNS, true)
  if (!error) return (data ?? []) as PestControlLog[]
  const { data: legacy } = await build(LEGACY_PEST_COLUMNS, false)
  return (legacy ?? []) as PestControlLog[]
}

/** Filtered history hook — pass date strings 'yyyy-MM-dd' */
export function usePestControlLogs(dateFrom: string | null, dateTo: string | null): {
  logs: PestControlLog[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pestControlLogs', venueId, dateFrom, dateTo],
    queryFn: () => selectWithFallback((columns) => {
      let q = supabase
        .from('pest_control_logs')
        .select(columns)
        .eq('venue_id', venueId)
        .order('logged_at', { ascending: false })
        .limit(500)

      // Local-day bounds, so an evening entry never lands on the next day
      if (dateFrom) q = q.gte('logged_at', new Date(`${dateFrom}T00:00:00`).toISOString())
      if (dateTo)   q = q.lte('logged_at', new Date(`${dateTo}T23:59:59`).toISOString())
      return q
    }),
    enabled: !!venueId,
  })

  return { logs: (data ?? []) as PestControlLog[], loading: isLoading, reload: refetch }
}

/**
 * Open issues — sightings/treatments still open that aren't themselves about
 * an earlier issue — each with its linked treatments and follow-ups.
 */
export function useOpenPestIssues(): { issues: PestIssue[]; loading: boolean } {
  const { venueId } = useVenue()

  const { data, isLoading } = useQuery({
    queryKey: ['openPestIssues', venueId],
    queryFn: async () => {
      const open = await selectWithFallback((columns, linked) => {
        let q = supabase
          .from('pest_control_logs')
          .select(columns)
          .eq('venue_id', venueId)
          .eq('status', 'open')
          .in('log_type', ['sighting', 'treatment'])
          .order('logged_at', { ascending: false })
        if (linked) q = q.is('issue_id', null)
        return q
      })
      if (open.length === 0 || !('issue_id' in open[0])) {
        return open.map(issue => ({ ...issue, timeline: [] })) as PestIssue[]
      }
      const { data: linked } = await supabase
        .from('pest_control_logs')
        .select(PEST_COLUMNS)
        .in('issue_id', open.map(i => i.id))
        .order('logged_at', { ascending: true })
      const byIssue = new Map<string, PestControlLog[]>()
      for (const log of (linked ?? []) as PestControlLog[]) {
        const list = byIssue.get(log.issue_id!) ?? []
        list.push(log)
        byIssue.set(log.issue_id!, list)
      }
      return open.map(issue => ({ ...issue, timeline: byIssue.get(issue.id) ?? [] })) as PestIssue[]
    },
    enabled: !!venueId,
  })

  return { issues: (data ?? []) as PestIssue[], loading: isLoading }
}

/** Most-used locations, topped up with defaults, for quick-pick chips. */
export function usePestLocations(limit = 5): string[] {
  const { venueId } = useVenue()

  const { data = [] } = useQuery({
    queryKey: ['pestLocations', venueId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('pest_control_logs')
        .select('location')
        .eq('venue_id', venueId)
        .order('logged_at', { ascending: false })
        .limit(300)
      const counts = new Map<string, { name: string; n: number }>()
      for (const row of (rows ?? []) as { location: string }[]) {
        const name = row.location?.trim()
        if (!name) continue
        const entry = counts.get(name.toLowerCase()) ?? { name, n: 0 }
        entry.n++
        counts.set(name.toLowerCase(), entry)
      }
      return [...counts.values()].filter(e => e.n > 1).sort((a, b) => b.n - a.n).map(e => e.name)
    },
    enabled: !!venueId,
    staleTime: 5 * 60_000,
  })

  const merged = [...data]
  for (const name of DEFAULT_PEST_LOCATIONS) {
    if (!merged.some(m => m.toLowerCase() === name.toLowerCase())) merged.push(name)
  }
  return merged.slice(0, limit)
}

/** Refresh everything that shows pest data after a write. */
export function useRefreshPest(): () => void {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['openPestIssues', venueId] })
    queryClient.invalidateQueries({ queryKey: ['pestControlLogs', venueId] })
    queryClient.invalidateQueries({ queryKey: ['pestLocations', venueId] })
    queryClient.invalidateQueries({ queryKey: ['widget', 'compliance_score', venueId] })
  }
}
