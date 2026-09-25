import { useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export const DOCUMENT_CATEGORIES = [
  { value: 'licences',      label: 'Licences' },
  { value: 'insurance',     label: 'Insurance' },
  { value: 'health_safety', label: 'Health & Safety' },
  { value: 'eho_reports',   label: 'EHO Reports' },
  { value: 'other',         label: 'Other' },
] as const

export const EXPIRY_WARNING_DAYS = 30

export interface VenueDocument {
  id: string
  venue_id: string
  title: string
  category: string
  file_url: string | null   // legacy public URL, pre-123
  file_path: string | null  // storage key in the private venue-documents bucket
  file_name: string
  file_size: number | null
  expiry_date: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export type DocumentStatus = 'expired' | 'expiring' | 'valid' | 'none'

/** Where a document stands today, and how many days it has left. */
export function documentStatus(doc: Pick<VenueDocument, 'expiry_date'>, today = new Date()): { status: DocumentStatus; daysLeft: number | null } {
  if (!doc.expiry_date) return { status: 'none', daysLeft: null }
  const daysLeft = differenceInCalendarDays(parseISO(doc.expiry_date), today)
  if (daysLeft < 0) return { status: 'expired', daysLeft }
  if (daysLeft <= EXPIRY_WARNING_DAYS) return { status: 'expiring', daysLeft }
  return { status: 'valid', daysLeft }
}

export function useDocuments(): { docs: VenueDocument[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['documents', venueId]

  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('documents')
        .select('id, venue_id, title, category, file_url, file_path, file_name, file_size, expiry_date, notes, uploaded_by, created_at')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
      return (rows ?? []) as VenueDocument[]
    },
    enabled: !!venueId,
  })

  const reload = () => queryClient.invalidateQueries({ queryKey })

  return { docs: data, loading: isLoading, reload }
}
