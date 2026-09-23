import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fetchStaffPayRates, withPayRates, fetchStaffPrivateFields, withPrivateFields } from '../lib/api/staffRestricted'
import { useVenue } from '../contexts/VenueContext'

interface StaffMember {
  id: string
  name: string
  email?: string
  job_role?: string
  role?: string
  permission_title_id?: string | null
  hourly_rate?: number
  is_active: boolean
  is_restricted?: boolean
  show_temp_logs?: boolean
  show_allergens?: boolean
  photo_url?: string
  skills?: string[]
  is_under_18?: boolean
  working_days?: number[]
  sort_order?: number
  pin_failed_attempts?: number
  pin_locked_until?: string | null
  employment_type?: string | null
  contracted_hours?: number | null
  start_date?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  holiday_pay_eligible?: boolean
  colour?: string | null
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
        .select('id, name, job_role, role, permission_title_id, is_active, is_restricted, show_temp_logs, show_allergens, photo_url, skills, is_under_18, working_days, sort_order, pin_failed_attempts, pin_locked_until, employment_type, holiday_pay_eligible, colour')
        .eq('venue_id', venueId)
        .order('sort_order')
        .order('name')
      // hourly_rate (117) plus email, emergency contacts, start_date and
      // contracted_hours (118) can no longer be selected from the table. Both
      // RPCs return the whole venue to a manager and only your own row to
      // anyone else; this page is manager-only, so the merge is complete here.
      const [rates, priv] = await Promise.all([fetchStaffPayRates(), fetchStaffPrivateFields()])
      return withPrivateFields(withPayRates((data ?? []) as StaffMember[], rates), priv) as StaffMember[]
    },
    enabled: !!venueId,
  })

  return { staff, loading, reload: refetch }
}
