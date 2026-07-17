import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import {
  fetchSignOffs, fetchCertRecords, fetchActiveStaff, fetchAllergenCerts,
  type SignOffRecord, type CertRecord, type StaffLite,
} from '../lib/api/training'

interface TrainingRecord {
  id: string
  title: string
  provider?: string
  expiry_date?: string
  certificate_url?: string
  staff_id: string
  venue_id: string
  created_at: string
}

export function useStaffTraining(staffId: string): {
  records: TrainingRecord[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staffTraining', venueId, staffId],
    queryFn: async () => {
      if (!staffId) return [] as TrainingRecord[]
      let q = supabase
        .from('staff_training')
        .select('id, title, provider, expiry_date, certificate_url, staff_id, venue_id, created_at')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false })
      if (venueId) q = q.eq('venue_id', venueId)
      const { data } = await q
      return (data ?? []) as TrainingRecord[]
    },
    enabled: !!staffId,
  })

  return { records: data ?? [], loading: isLoading, reload: refetch }
}

/** Venue-wide training sign-offs (React Query, 60s cache). */
export function useSignOffs(): { records: SignOffRecord[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['trainingSignOffs', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSignOffs(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { records: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}

/** Venue-wide certificate/training records (React Query, 60s cache). */
export function useCertRecords(): { records: CertRecord[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['trainingCertRecords', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchCertRecords(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { records: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}

/** Venue-wide allergen-awareness training records (React Query, 60s cache). */
export function useAllergenCerts(): { certs: CertRecord[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()
  const queryKey = ['trainingAllergenCerts', venueId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchAllergenCerts(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return { certs: data ?? [], loading: isLoading, reload: () => queryClient.invalidateQueries({ queryKey }) }
}

/** Active staff for the current venue (training assignment pickers). */
export function useActiveStaff(): StaffLite[] {
  const { venueId } = useVenue()

  const { data } = useQuery({
    queryKey: ['activeStaff', venueId],
    queryFn: () => fetchActiveStaff(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
    placeholderData: [],
  })

  return data ?? []
}
