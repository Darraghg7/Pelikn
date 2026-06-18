/**
 * DashboardPage — thin role router.
 * Managers → ManagerDashboard (with onboarding redirect if needed)
 * Everyone else → StaffDashboardPage (My Shift view)
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'
import { useVenue } from '../contexts/VenueContext'
import StaffDashboardPage  from './dashboard/StaffDashboardPage'
import ManagerDashboardPage from './dashboard/ManagerDashboardPage'

export default function DashboardPage() {
  const { isManager } = useSession()
  const { venueId, venueSlug } = useVenue()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(!isManager)

  useEffect(() => {
    if (!isManager || !venueId) { setChecked(true); return }
    supabase
      .from('app_settings')
      .select('value')
      .eq('venue_id', venueId)
      .eq('key', 'onboarding_complete')
      .maybeSingle()
      .then(async ({ data }) => {
        if (data?.value === 'true') {
          // Wizard already completed for this venue — proceed normally.
          setChecked(true)
          return
        }
        // onboarding_complete is missing or not 'true'.
        // Before sending them through the wizard, check whether this is a
        // pre-existing venue that was simply created before the wizard existed
        // (≥2 staff members means it was already set up manually).
        const { count } = await supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
        if (typeof count === 'number' && count > 1) {
          // Existing venue — mark complete silently so it never prompts again.
          await supabase.from('app_settings').upsert({
            venue_id: venueId, key: 'onboarding_complete', value: 'true',
          }, { onConflict: 'venue_id,key' })
          setChecked(true)
        } else {
          // New venue (0–1 staff) — send through the setup wizard.
          navigate(`/v/${venueSlug}/setup`, { replace: true })
        }
      })
      .catch(() => setChecked(true))
  }, [isManager, venueId, venueSlug, navigate])

  if (!checked) return null
  return isManager ? <ManagerDashboardPage /> : <StaffDashboardPage />
}
