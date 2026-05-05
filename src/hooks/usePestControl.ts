import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const PEST_LOG_TYPES = [
  { value: 'inspection', label: 'Routine Inspection' },
  { value: 'sighting',   label: 'Pest Sighting' },
  { value: 'treatment',  label: 'Treatment' },
  { value: 'follow_up',  label: 'Follow-up' },
]

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

interface PestControlLog {
  id: string
  log_type: string
  pest_type?: string
  severity?: string
  location?: string
  notes?: string
  status: string
  logged_at: string
  logged_by_name?: string
  venue_id: string
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
    queryFn: async () => {
      if (!venueId) return [] as PestControlLog[]
      let q = supabase
        .from('pest_control_logs')
        .select('id, log_type, pest_type, severity, location, notes, status, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .order('logged_at', { ascending: false })
        .limit(200)

      if (dateFrom) q = q.gte('logged_at', dateFrom)
      if (dateTo)   q = q.lte('logged_at', dateTo + 'T23:59:59')

      const { data } = await q
      return (data ?? []) as PestControlLog[]
    },
    enabled: !!venueId,
  })

  return { logs: (data ?? []) as PestControlLog[], loading: isLoading, reload: refetch }
}

/** Returns open issues only — for dashboard / compliance */
export function useOpenPestIssues(): { issues: PestControlLog[]; loading: boolean } {
  const { venueId } = useVenue()

  const { data, isLoading } = useQuery({
    queryKey: ['openPestIssues', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pest_control_logs')
        .select('id, log_type, pest_type, severity, location, notes, status, logged_at, logged_by_name, venue_id')
        .eq('venue_id', venueId)
        .eq('status', 'open')
        .in('log_type', ['sighting', 'treatment'])
        .order('logged_at', { ascending: false })
      return (data ?? []) as PestControlLog[]
    },
    enabled: !!venueId,
  })

  return { issues: (data ?? []) as PestControlLog[], loading: isLoading }
}
