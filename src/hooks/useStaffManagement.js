import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'

export default function useStaffManagement() {
  const { venueId } = useVenue()
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('staff')
      .select('id, name, email, job_role, role, hourly_rate, is_active, show_temp_logs, show_allergens, photo_url, skills, is_under_18, working_days, sort_order, pin_failed_attempts, pin_locked_until')
      .eq('venue_id', venueId)
      .order('sort_order')
      .order('name')
    setStaff(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [venueId])
  return { staff, loading, reload: load }
}
