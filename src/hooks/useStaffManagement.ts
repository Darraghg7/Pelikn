import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

interface StaffMember {
  id: string
  name: string
  email?: string
  job_role?: string
  role?: string
  hourly_rate?: number
  is_active: boolean
  show_temp_logs?: boolean
  show_allergens?: boolean
  photo_url?: string
  skills?: string[]
  is_under_18?: boolean
  working_days?: number[]
  sort_order?: number
  pin_failed_attempts?: number
  pin_locked_until?: string | null
}

export default function useStaffManagement(): {
  staff: StaffMember[]
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data: staff = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['staff_management', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, name, email, job_role, role, hourly_rate, is_active, show_temp_logs, show_allergens, photo_url, skills, is_under_18, working_days, sort_order, pin_failed_attempts, pin_locked_until')
        .eq('venue_id', venueId)
        .order('sort_order')
        .order('name')
      return (data ?? []) as StaffMember[]
    },
    enabled: !!venueId,
  })

  return { staff, loading, reload: refetch }
}
